from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import RegisterViewSet, UserViewSet


router = DefaultRouter()
router.register(r"profiles", UserViewSet, basename="user")
router.register(r"register", RegisterViewSet, basename="register")

urlpatterns = [
    path("", include(router.urls)),
]

