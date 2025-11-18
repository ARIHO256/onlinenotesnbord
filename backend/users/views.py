from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from rest_framework_simplejwt.views import TokenObtainPairView

from .models import DeviceToken, User
from .serializers import DeviceTokenSerializer, EmailTokenObtainPairSerializer, RegisterSerializer, UserSerializer


class IsSelfOrAdmin(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user and request.user.is_staff:
            return True
        return obj.id == getattr(request.user, "id", None)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("id")
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def faculty(self, request):
        qs = User.objects.filter(is_faculty=True).order_by("id")
        return Response(UserSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def students(self, request):
        qs = User.objects.filter(is_faculty=False).order_by("id")
        return Response(UserSerializer(qs, many=True).data)

    def get_permissions(self):
        if self.action in ["update", "partial_update", "destroy", "retrieve"]:
            return [permissions.IsAuthenticated(), IsSelfOrAdmin()]
        return super().get_permissions()

    @action(detail=True, methods=["get"], permission_classes=[permissions.IsAuthenticated], url_path="public")
    def public(self, request, pk=None):
        """
        Return a read-only view of another user's profile for authenticated viewers.
        """
        user = self.get_object()
        serializer = UserSerializer(user, context={"request": request})
        return Response(serializer.data)


class RegisterViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer

    @action(detail=False, methods=["post"], permission_classes=[permissions.AllowAny])
    def register(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data)

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated], url_path="register-device")
    def register_device(self, request):
        serializer = DeviceTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        DeviceToken.objects.update_or_create(user=request.user, token=serializer.validated_data["token"])
        return Response({"status": "registered"})

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated], url_path="unregister-device")
    def unregister_device(self, request):
        serializer = DeviceTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        DeviceToken.objects.filter(user=request.user, token=serializer.validated_data["token"]).delete()
        return Response({"status": "unregistered"})


class EmailTokenObtainPairView(TokenObtainPairView):
    """
    SimpleJWT token view that authenticates using email address.
    """

    serializer_class = EmailTokenObtainPairSerializer

