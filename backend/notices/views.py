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
    NON_ACADEMIC_DEPARTMENTS,
    NoticeView,
    Report,
)
from .serializers import AttachmentSerializer, CommentSerializer, NoticeSerializer, ReportSerializer


LEADERSHIP_KEYWORDS = ["registrar", "administrator", "admin", "hod", "head of department"]


class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if getattr(request.user, "is_staff", False):
            return True
        return getattr(obj, "created_by_id", None) == getattr(request.user, "id", None)


class NoticeFilter(filters.FilterSet):
    created_by = filters.NumberFilter(field_name="created_by_id")

    class Meta:
        model = Notice
        fields = {
            "department": ["exact"],
            "is_active": ["exact"],
            "created_by": ["exact"],
            "category": ["exact"],
        }


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

        global_actions = {"trending", "most_liked", "favorites", "suggested"}
        if getattr(self, "action", None) in global_actions:
            return qs.order_by("-is_pinned", "-created_at")

        return qs.order_by("-is_pinned", "-created_at")

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
        fcm_key = getattr(settings, "FCM_SERVER_KEY", None)
        if not fcm_key:
            return
        from users.models import DeviceToken, User  # local import
        users = User.objects.filter(Q(department=notice.department) | Q(department__in=NON_ACADEMIC_DEPARTMENTS))
        tokens = list(DeviceToken.objects.filter(user__in=users).values_list("token", flat=True))
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

