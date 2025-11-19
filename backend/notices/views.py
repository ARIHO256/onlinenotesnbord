from rest_framework import permissions, status, viewsets
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django_filters import rest_framework as filters

from django.db import models
from django.db.models import Q
from django.utils import timezone
from django.conf import settings
import requests
import mimetypes

from .models import (
    Attachment,
    Comment,
    CommentLike,
    Favorite,
    Like,
    Notice,
    NoticeCategory,
    NoticeTemplate,
    NoticeReminder,
    NON_ACADEMIC_DEPARTMENTS,
    NoticeView,
    Report,
)
from .serializers import AttachmentSerializer, CommentSerializer, NoticeSerializer, NoticeTemplateSerializer, ReportSerializer


LEADERSHIP_KEYWORDS = ["registrar", "administrator", "admin", "hod", "head of department"]

# Cross-cutting official departments that send notices to all students
CROSS_CUTTING_OFFICIAL_DEPARTMENTS = [
    "Registrar",
    "Vice Chancellor",
    "Business Office",
    "Head of Security",
    "Chaplain",
]

# Official designations from User model
OFFICIAL_DESIGNATIONS = [
    "vice_chancellor",
    "registrar",
    "business_office",
    "security",
    "lecturer",
    "dean",
    "hod",
]

OFFICIAL_ROLES_KEYWORDS = [
    "admin", "administrator", "registrar",
    "hod", "head of department",
    "lecturer", "lecture",
    "guild president", "guild",
    "coordinator", "class coordinator",
    "dean", "director",
    "vice chancellor", "vc",
    "business office",
    "security",
]


class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if getattr(request.user, "is_staff", False):
            return True
        return getattr(obj, "created_by_id", None) == getattr(request.user, "id", None)


class NoticeFilter(filters.FilterSet):
    created_by = filters.NumberFilter(field_name="created_by_id")
    priority = filters.ChoiceFilter(choices=[("urgent", "Urgent"), ("important", "Important"), ("normal", "Normal")])
    expired = filters.BooleanFilter(method="filter_expired")
    department_list = filters.CharFilter(method="filter_department_list")

    class Meta:
        model = Notice
        fields = {
            "department": ["exact"],
            "is_active": ["exact"],
            "created_by": ["exact"],
            "category": ["exact"],
            "priority": ["exact"],
        }

    def filter_expired(self, queryset, name, value):
        now = timezone.now()
        if value:
            return queryset.filter(expires_at__lte=now)
        return queryset.filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))

    def filter_department_list(self, queryset, name, value):
        departments = [d.strip() for d in value.split(",") if d.strip()]
        if departments:
            return queryset.filter(department__in=departments)
        return queryset


class NoticeViewSet(viewsets.ModelViewSet):
    queryset = Notice.objects.all()
    serializer_class = NoticeSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ["title", "description", "department", "created_by__username"]
    ordering_fields = ["created_at", "views_count"]
    filterset_class = NoticeFilter

    def get_permissions(self):
        unrestricted_actions = {
            "list",
            "retrieve",
            "like",
            "unlike",
            "favorite",
            "unfavorite",
            "favorites",
            "comments",
            "like_comment",
            "unlike_comment",
            "trending",
            "most_liked",
            "suggested",
        }
        if getattr(self, "action", None) in unrestricted_actions:
            return [permissions.IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()

        # Staff can access all notices regardless of schedule window or active flag
        if getattr(user, "is_staff", False):
            return qs.order_by("-is_pinned", "-created_at")

        now = timezone.now()
        qs = qs.filter(is_active=True).filter(Q(scheduled_at__isnull=True) | Q(scheduled_at__lte=now))
        # Filter out expired notices
        qs = qs.filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))

        # For students, filter official notices by department/school rules
        if not getattr(user, "is_staff", False):
            user_department = getattr(user, "department", "") or ""
            user_school = getattr(user, "school", "") or ""
            
            # Identify official notices (from staff/faculty/leadership roles)
            designation_filter = Q()
            for keyword in OFFICIAL_ROLES_KEYWORDS:
                designation_filter |= Q(created_by__designation__icontains=keyword)
            
            # Check for official designations
            official_designation_filter = Q()
            for desig in OFFICIAL_DESIGNATIONS:
                official_designation_filter |= Q(created_by__designation=desig)
            
            official_notices_filter = Q(
                created_by__is_staff=True
            ) | Q(
                created_by__is_superuser=True
            ) | Q(
                created_by__is_faculty=True
            ) | designation_filter | official_designation_filter
            
            # Cross-cutting departments (all students receive)
            cross_cutting_filter = Q()
            for dept in CROSS_CUTTING_OFFICIAL_DEPARTMENTS:
                cross_cutting_filter |= Q(department__icontains=dept) | Q(created_by__designation__icontains=dept.lower())
            # Also check for official designations that are cross-cutting
            cross_cutting_filter |= Q(created_by__designation__in=["vice_chancellor", "registrar", "business_office", "security"])
            
            # Department filter for HOD notices
            department_filter = Q()
            if user_department:
                department_filter = Q(department=user_department) | Q(created_by__department=user_department)
            
            # School filter for Dean notices
            school_filter = Q()
            if user_school:
                school_filter = Q(created_by__school=user_school)
            
            # Filter: Show non-official notices to all, OR official notices that match rules
            # Official notices must be: cross-cutting OR match department OR match school
            official_visibility_filter = cross_cutting_filter | department_filter | school_filter
            
            # Combine: (NOT official) OR (official AND visible to user)
            qs = qs.filter(
                ~official_notices_filter | (official_notices_filter & official_visibility_filter)
            )

        global_actions = {"trending", "most_liked", "favorites", "suggested", "official"}
        if getattr(self, "action", None) in global_actions:
            from django.db.models import Case, When, IntegerField
            priority_order = Case(
                When(priority="urgent", then=1),
                When(priority="important", then=2),
                When(priority="normal", then=3),
                default=3,
                output_field=IntegerField(),
            )
            return qs.order_by(priority_order, "-is_pinned", "-created_at")

        from django.db.models import Case, When, IntegerField
        priority_order = Case(
            When(priority="urgent", then=1),
            When(priority="important", then=2),
            When(priority="normal", then=3),
            default=3,
            output_field=IntegerField(),
        )
        return qs.order_by(priority_order, "-is_pinned", "-created_at")

    def perform_create(self, serializer):
        user = self.request.user
        department_value, category_value = self._resolve_department_and_category(user, serializer)
        notice = serializer.save(
            created_by=user,
            department=department_value,
            category=category_value,
        )
        # Send push to department users if scheduled_at is now or past
        if not notice.scheduled_at or notice.scheduled_at <= timezone.now():
            self._send_push_to_department(notice)

    def perform_update(self, serializer):
        user = self.request.user
        department_value, category_value = self._resolve_department_and_category(user, serializer, is_update=True)
        serializer.save(department=department_value, category=category_value)

    def _resolve_department_and_category(self, user, serializer, *, is_update: bool = False):
        """
        Determine the department and category for a notice create/update while enforcing role rules.
        """
        data = serializer.validated_data
        instance = getattr(serializer, "instance", None)
        is_faculty = getattr(user, "is_faculty", False)
        user_department = getattr(user, "department", "") or ""

        # Resolve department
        if self._can_manage_department(user):
            department_value = data.get("department")
            if department_value is None and instance is not None:
                department_value = instance.department
            if department_value is None:
                department_value = user_department
        else:
            # Non-staff users default to their own department
            department_value = user_department

        # Resolve category
        category_value = data.get("category")
        if category_value is None and instance is not None:
            category_value = instance.category
        if category_value is None:
            category_value = NoticeCategory.CAMPUS_LIFE

        # Guard education category
        if category_value == NoticeCategory.EDUCATION:
            if not self._can_post_education(user):
                raise permissions.PermissionDenied(
                    "Only administrators, registrars, or department heads can post in Education."
                )

        # Students cannot post in restricted categories
        if not (self._can_manage_department(user) or is_faculty) and category_value == NoticeCategory.EDUCATION:
            raise permissions.PermissionDenied("Students cannot post in Education.")

        return department_value, category_value

    def _can_post_education(self, user) -> bool:
        if getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
            return True
        designation = (getattr(user, "designation", "") or "").lower()
        return any(keyword in designation for keyword in LEADERSHIP_KEYWORDS)

    def _can_manage_department(self, user) -> bool:
        if getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
            return True
        designation = (getattr(user, "designation", "") or "").lower()
        return any(keyword in designation for keyword in LEADERSHIP_KEYWORDS)
    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        notice_id = kwargs.get(self.lookup_field, None)
        try:
            notice = Notice.objects.get(pk=notice_id)
            NoticeView.objects.create(notice=notice, user=request.user)
            Notice.objects.filter(pk=notice.pk).update(views_count=models.F("views_count") + 1)
        except Notice.DoesNotExist:
            pass
        return response

    @action(detail=True, methods=["post"])
    def like(self, request, pk=None):
        notice = self.get_object()
        Like.objects.get_or_create(notice=notice, user=request.user)
        return Response({"status": "liked"})

    @action(detail=True, methods=["post"])
    def unlike(self, request, pk=None):
        notice = self.get_object()
        Like.objects.filter(notice=notice, user=request.user).delete()
        return Response({"status": "unliked"})

    @action(detail=True, methods=["post"])
    def favorite(self, request, pk=None):
        notice = self.get_object()
        Favorite.objects.get_or_create(notice=notice, user=request.user)
        return Response({"status": "favorited"})

    @action(detail=True, methods=["post"])
    def unfavorite(self, request, pk=None):
        notice = self.get_object()
        Favorite.objects.filter(notice=notice, user=request.user).delete()
        return Response({"status": "unfavorited"})

    @action(detail=False, methods=["get"])
    def favorites(self, request):
        ids = Favorite.objects.filter(user=request.user).values_list("notice_id", flat=True)
        qs = self.get_queryset().filter(id__in=list(ids))
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, pk=None):
        notice = self.get_object()
        if request.method.lower() == "get":
            qs = (
                Comment.objects.filter(notice=notice, parent__isnull=True)
                .select_related("user")
                .prefetch_related(
                    "likes",
                    "replies__user",
                    "replies__likes",
                    "replies__replies__user",
                    "replies__replies__likes",
                )
                .order_by("-created_at")
            )
            context = {"request": request, "depth": 0, "max_depth": request.query_params.get("max_depth", 2)}
            return Response(CommentSerializer(qs, many=True, context=context).data)
        payload = {**request.data, "notice": notice.id}
        serializer = CommentSerializer(data=payload, context={"request": request})
        serializer.is_valid(raise_exception=True)
        comment = serializer.save(user=request.user, notice=notice)
        response_data = CommentSerializer(comment, context={"request": request}).data
        return Response(response_data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="comments/(?P<comment_id>[^/.]+)/like")
    def like_comment(self, request, pk=None, comment_id: str = ""):
        notice = self.get_object()
        try:
            comment = notice.comments.get(id=comment_id)
        except Comment.DoesNotExist:
            return Response({"detail": "Comment not found"}, status=status.HTTP_404_NOT_FOUND)
        CommentLike.objects.get_or_create(comment=comment, user=request.user)
        return Response({"status": "liked"})

    @action(detail=True, methods=["post"], url_path="comments/(?P<comment_id>[^/.]+)/unlike")
    def unlike_comment(self, request, pk=None, comment_id: str = ""):
        notice = self.get_object()
        try:
            comment = notice.comments.get(id=comment_id)
        except Comment.DoesNotExist:
            return Response({"detail": "Comment not found"}, status=status.HTTP_404_NOT_FOUND)
        CommentLike.objects.filter(comment=comment, user=request.user).delete()
        return Response({"status": "unliked"})

    @action(detail=True, methods=["post"], url_path="attachments", parser_classes=[MultiPartParser, FormParser])
    def attachments(self, request, pk=None):
        notice = self.get_object()
        uploaded_file = request.FILES.get("file") or request.FILES.get("image")
        if not uploaded_file:
            return Response({"detail": "No file provided"}, status=400)
        content_type = getattr(uploaded_file, "content_type", "") or mimetypes.guess_type(uploaded_file.name)[0] or ""
        if content_type.startswith("image/"):
            file_type = "image"
        elif content_type.startswith("video/"):
            file_type = "video"
        elif content_type.startswith("audio/"):
            file_type = "audio"
        else:
            file_type = "document"
        attachment = Attachment.objects.create(
            notice=notice,
            file=uploaded_file,
            file_type=file_type,
            original_name=getattr(uploaded_file, "name", ""),
        )
        serializer = AttachmentSerializer(attachment, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path="attachments/(?P<attachment_id>[^/.]+)")
    def delete_attachment(self, request, pk=None, attachment_id: str = ""):
        notice = self.get_object()
        if notice.created_by_id != request.user.id and not request.user.is_staff:
            raise permissions.PermissionDenied("Cannot modify attachments for this notice")
        try:
            a = Attachment.objects.get(id=attachment_id, notice=notice)
        except Attachment.DoesNotExist:
            return Response({"detail": "Attachment not found"}, status=404)
        a.delete()
        return Response({"status": "deleted"})

    @action(detail=True, methods=["post"], url_path="report")
    def report(self, request, pk=None):
        notice = self.get_object()
        serializer = ReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        Report.objects.create(notice=notice, user=request.user, reason=serializer.validated_data["reason"])
        return Response({"status": "reported"})

    def _send_push_to_department(self, notice: Notice) -> None:
        """
        Send push notifications based on notice source and department rules:
        - Cross-cutting departments → all students
        - HOD notices → only students in that department
        - Dean notices → only students in that school
        """
        fcm_key = getattr(settings, "FCM_SERVER_KEY", None)
        if not fcm_key:
            return
        from users.models import DeviceToken, User  # local import
        
        notice_department = notice.department or ""
        notice_creator = notice.created_by
        creator_designation_value = getattr(notice_creator, "designation", "") or ""
        creator_designation = creator_designation_value  # For backward compatibility with string matching
        creator_department = getattr(notice_creator, "department", "") or ""
        creator_school = getattr(notice_creator, "school", "") or ""
        
        # Check if notice is from cross-cutting department
        is_cross_cutting = False
        
        # Check designation value directly
        if creator_designation_value in ["vice_chancellor", "registrar", "business_office", "security"]:
            is_cross_cutting = True
        else:
            # Check department names
            for dept in CROSS_CUTTING_OFFICIAL_DEPARTMENTS:
                if (dept.lower() in notice_department.lower() or 
                    dept.lower() in creator_designation.lower() or
                    dept.lower() in creator_department.lower()):
                    is_cross_cutting = True
                    break
        
        # Determine target users
        if is_cross_cutting:
            # Cross-cutting: send to all students
            users = User.objects.filter(is_staff=False, is_superuser=False)
        elif creator_designation_value == "hod" or "hod" in creator_designation.lower() or "head of department" in creator_designation.lower():
            # HOD notices: only students in that department
            target_dept = notice_department or creator_department
            if target_dept:
                users = User.objects.filter(
                    department=target_dept,
                    is_staff=False,
                    is_superuser=False
                )
            else:
                return  # No department specified, skip
        elif creator_designation_value == "dean" or "dean" in creator_designation.lower() or "director" in creator_designation.lower():
            # Dean notices: only students in that school
            target_school = creator_school
            if target_school:
                users = User.objects.filter(
                    school=target_school,
                    is_staff=False,
                    is_superuser=False
                )
            else:
                return  # No school specified, skip
        elif creator_designation_value == "lecturer":
            # Lecturer notices: send to their department
            target_dept = notice_department or creator_department
            if target_dept:
                users = User.objects.filter(
                    department=target_dept,
                    is_staff=False,
                    is_superuser=False
                )
            else:
                return  # No department specified, skip
        else:
            # Default: send to department or all if no department
            if notice_department:
                users = User.objects.filter(
                    Q(department=notice_department) | Q(department__in=NON_ACADEMIC_DEPARTMENTS),
                    is_staff=False,
                    is_superuser=False
                )
            else:
                # No department specified, send to all students
                users = User.objects.filter(is_staff=False, is_superuser=False)
        
        tokens = list(DeviceToken.objects.filter(user__in=users, user__push_enabled=True).values_list("token", flat=True))
        if not tokens:
            return
        try:
            requests.post(
                "https://exp.host/--/api/v2/push/send",
                json=[{
                    "to": t,
                    "title": f"{notice.title}",
                    "body": (notice.description[:100] + ("…" if len(notice.description) > 100 else "")),
                    "data": {"noticeId": notice.id},
                } for t in tokens],
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {fcm_key}"},
                timeout=4,
            )
        except Exception:
            return

    @action(detail=False, methods=["get"])
    def trending(self, request):
        # Simple heuristic: most views in recent window
        qs = self.get_queryset().order_by("-views_count", "-created_at")[:50]
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="official")
    def official(self, request):
        """
        Get notices from official/leadership roles filtered by user's department and school.
        Rules:
        - Cross-cutting departments (Registrar, Vice Chancellor, Business Office, Head of Security, Chaplain) → all students
        - HOD notices → only students in that department
        - Dean notices → only students in that school
        - Other official notices → filtered by department/school
        """
        user = request.user
        qs = self.get_queryset()
        
        # Filter by official roles
        designation_filter = Q()
        for keyword in OFFICIAL_ROLES_KEYWORDS:
            designation_filter |= Q(created_by__designation__icontains=keyword)
        
        # Check for official designations
        official_designation_filter = Q()
        for desig in OFFICIAL_DESIGNATIONS:
            official_designation_filter |= Q(created_by__designation=desig)
        
        # Base filter for official notices
        official_base_qs = qs.filter(
            Q(created_by__is_staff=True) |
            Q(created_by__is_superuser=True) |
            Q(created_by__is_faculty=True) |
            designation_filter |
            official_designation_filter
        )
        
        # If user is staff, show all official notices
        if getattr(user, "is_staff", False):
            official_qs = official_base_qs
        else:
            # For students, filter based on department/school rules
            user_department = getattr(user, "department", "") or ""
            user_school = getattr(user, "school", "") or ""
            
            # Notices from cross-cutting departments (go to everyone)
            cross_cutting_filter = Q()
            for dept in CROSS_CUTTING_OFFICIAL_DEPARTMENTS:
                cross_cutting_filter |= Q(department__icontains=dept) | Q(created_by__designation__icontains=dept.lower())
            # Also check for official designations that are cross-cutting
            cross_cutting_filter |= Q(created_by__designation__in=["vice_chancellor", "registrar", "business_office", "security"])
            
            # Notices from user's department (HOD notices)
            department_filter = Q()
            if user_department:
                department_filter = Q(department=user_department) | Q(created_by__department=user_department)
            
            # Notices from user's school (Dean notices)
            school_filter = Q()
            if user_school:
                # Match by school name in department or created_by's school
                school_filter = Q(created_by__school=user_school)
            
            # Combine: cross-cutting OR (user's department) OR (user's school)
            official_qs = official_base_qs.filter(
                cross_cutting_filter | department_filter | school_filter
            )
        
        # Order by priority, then pinned, then created_at
        from django.db.models import Case, When, IntegerField
        priority_order = Case(
            When(priority="urgent", then=1),
            When(priority="important", then=2),
            When(priority="normal", then=3),
            default=3,
            output_field=IntegerField(),
        )
        official_qs = official_qs.order_by(priority_order, "-is_pinned", "-created_at")[:50]
        serializer = self.get_serializer(official_qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="for-you")
    def for_you(self, request):
        base_qs = self.get_queryset().filter(
            created_by__is_staff=False,
            created_by__is_faculty=False,
        )
        qs = self.filter_queryset(base_qs)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="category/(?P<category>[^/]+)")
    def by_category(self, request, category: str = ""):
        valid_categories = {choice[0] for choice in NoticeCategory.choices}
        if category not in valid_categories:
            return Response({"detail": "Unknown category"}, status=status.HTTP_400_BAD_REQUEST)
        base_qs = self.get_queryset().filter(category=category)
        qs = self.filter_queryset(base_qs)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="most-liked")
    def most_liked(self, request):
        qs = self.get_queryset().annotate(num_likes=models.Count("likes")).order_by("-num_likes", "-created_at")[:50]
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="suggested")
    def suggested(self, request):
        qs = (
            self.get_queryset()
            .annotate(num_likes=models.Count("likes"), num_comments=models.Count("comments"))
            .order_by("-num_likes", "-num_comments", "-created_at")
        )
        serializer = self.get_serializer(qs[:50], many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="pin")
    def pin(self, request, pk=None):
        notice = self.get_object()
        if notice.created_by_id != request.user.id and not request.user.is_staff:
            raise permissions.PermissionDenied("Cannot pin this notice")
        notice.is_pinned = True
        notice.save(update_fields=["is_pinned"])
        return Response({"status": "pinned"})

    @action(detail=True, methods=["post"], url_path="unpin")
    def unpin(self, request, pk=None):
        notice = self.get_object()
        if notice.created_by_id != request.user.id and not request.user.is_staff:
            raise permissions.PermissionDenied("Cannot unpin this notice")
        notice.is_pinned = False
        notice.save(update_fields=["is_pinned"])
        return Response({"status": "unpinned"})

    @action(detail=True, methods=["post"], url_path="remind")
    def set_reminder(self, request, pk=None):
        notice = self.get_object()
        remind_at = request.data.get("remind_at")
        if not remind_at:
            return Response({"detail": "remind_at is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            from datetime import datetime
            remind_datetime = datetime.fromisoformat(remind_at.replace("Z", "+00:00"))
            NoticeReminder.objects.get_or_create(
                notice=notice,
                user=request.user,
                remind_at=remind_datetime,
            )
            return Response({"status": "reminder_set"})
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"], url_path="analytics")
    def analytics(self, request):
        if not request.user.is_staff:
            return Response({"detail": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
        from django.db.models import Count, Avg, Q
        from datetime import timedelta
        now = timezone.now()
        last_30_days = now - timedelta(days=30)

        total_notices = Notice.objects.count()
        active_notices = Notice.objects.filter(is_active=True).count()
        expired_notices = Notice.objects.filter(expires_at__lte=now).count()
        recent_notices = Notice.objects.filter(created_at__gte=last_30_days).count()

        priority_stats = Notice.objects.values("priority").annotate(count=Count("id"))
        category_stats = Notice.objects.values("category").annotate(count=Count("id"))
        department_stats = Notice.objects.values("department").annotate(count=Count("id")).order_by("-count")[:10]

        avg_views = Notice.objects.aggregate(avg_views=Avg("views_count"))["avg_views"] or 0
        avg_likes = Notice.objects.aggregate(avg_likes=Avg("likes__id"))["avg_likes"] or 0

        return Response({
            "total_notices": total_notices,
            "active_notices": active_notices,
            "expired_notices": expired_notices,
            "recent_notices": recent_notices,
            "priority_stats": list(priority_stats),
            "category_stats": list(category_stats),
            "top_departments": list(department_stats),
            "avg_views": round(avg_views, 2),
            "avg_likes": round(avg_likes, 2),
        })


class NoticeTemplateViewSet(viewsets.ModelViewSet):
    queryset = NoticeTemplate.objects.all()
    serializer_class = NoticeTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        # Show public templates or user's own templates
        qs = qs.filter(Q(is_public=True) | Q(created_by=self.request.user))
        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

