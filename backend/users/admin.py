from django.contrib import admin

from .models import DeviceToken, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("id", "username", "email", "is_faculty", "is_staff", "school", "department", "course", "academic_year")
    search_fields = ("username", "email", "first_name", "last_name", "department", "school", "course")


@admin.register(DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "token", "created_at")

