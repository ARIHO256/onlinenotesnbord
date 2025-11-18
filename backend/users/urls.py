from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import FriendRequestViewSet, FriendshipViewSet, RegisterViewSet, UserViewSet


router = DefaultRouter()
router.register(r"profiles", UserViewSet, basename="user")
router.register(r"register", RegisterViewSet, basename="register")
router.register(r"friend-requests", FriendRequestViewSet, basename="friend-request")
router.register(r"friends", FriendshipViewSet, basename="friendship")

urlpatterns = [
    path("", include(router.urls)),
]

