from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    is_faculty = models.BooleanField(default=False)
    designation = models.CharField(max_length=100, blank=True)
    department = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    push_enabled = models.BooleanField(default=True)
    school = models.CharField(max_length=150, blank=True)
    course = models.CharField(max_length=150, blank=True)
    academic_year = models.CharField(max_length=20, blank=True)


class DeviceToken(models.Model):
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='device_tokens')
    token = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
