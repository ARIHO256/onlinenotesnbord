from django.contrib import admin

from .models import DeviceToken, FriendRequest, Friendship, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("id", "username", "email", "is_faculty", "is_staff", "school", "department", "course", "academic_year")
    search_fields = ("username", "email", "first_name", "last_name", "department", "school", "course")


@admin.register(DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "token", "created_at")


@admin.register(FriendRequest)
class FriendRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "sender", "receiver", "status", "created_at", "responded_at")
    list_filter = ("status",)
    search_fields = ("sender__username", "receiver__username")


@admin.register(Friendship)
class FriendshipAdmin(admin.ModelAdmin):
    list_display = ("id", "user_a", "user_b", "created_at")
    search_fields = ("user_a__username", "user_b__username")

