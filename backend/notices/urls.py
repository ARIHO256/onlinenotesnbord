from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import NoticeViewSet, NoticeTemplateViewSet


router = DefaultRouter()
router.register(r"", NoticeViewSet, basename="notice")
router.register(r"templates", NoticeTemplateViewSet, basename="notice-template")

urlpatterns = [
    path("", include(router.urls)),
]

