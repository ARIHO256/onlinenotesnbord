from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import DeviceToken, FriendRequest, Friendship, User, get_friend_status


class MiniUserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "avatar_url"]

    def get_avatar_url(self, obj):
        request = self.context.get("request")
        if getattr(obj, "avatar", None):
            url = obj.avatar.url
            if request is not None:
                return request.build_absolute_uri(url)
            return url
        return None


class UserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()
    avatar = serializers.ImageField(write_only=True, required=False, allow_null=True)
    friend_status = serializers.SerializerMethodField()
    friend_request_id = serializers.SerializerMethodField()
    mutual_friend_count = serializers.SerializerMethodField()
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_staff",
            "is_faculty",
            "designation",
            "department",
            "school",
            "course",
            "academic_year",
            "phone",
            "avatar",
            "avatar_url",
            "friend_status",
            "friend_request_id",
            "mutual_friend_count",
        ]
        read_only_fields = ["id", "username", "email", "is_staff"]

    def get_avatar_url(self, obj):
        request = self.context.get("request")
        if getattr(obj, "avatar", None):
            url = obj.avatar.url
            if request is not None:
                return request.build_absolute_uri(url)
            return url
        return None

    def get_friend_status(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return get_friend_status(user, obj)

    def get_friend_request_id(self, obj):
        request = self.context.get("request")
        viewer = getattr(request, "user", None)
        if not viewer or not getattr(viewer, "is_authenticated", False):
            return None
        status = get_friend_status(viewer, obj)
        if status == "outgoing":
            pending = FriendRequest.pending_between(viewer, obj)
            return pending.id if pending else None
        if status == "incoming":
            pending = FriendRequest.pending_between(obj, viewer)
            return pending.id if pending else None
        return None

    def get_mutual_friend_count(self, obj):
        request = self.context.get("request")
        viewer = getattr(request, "user", None)
        if not viewer or not getattr(viewer, "is_authenticated", False):
            return 0
        if viewer.id == obj.id:
            return 0
        return len(Friendship.mutual_friend_ids(viewer, obj))


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(required=True)
    last_name = serializers.CharField(required=True)
    school = serializers.CharField(required=True)
    department = serializers.CharField(required=True)
    course = serializers.CharField(required=True)
    academic_year = serializers.CharField(required=True)

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "password",
            "first_name",
            "last_name",
            "school",
            "department",
            "course",
            "academic_year",
        ]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class DeviceTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceToken
        fields = ["token"]


class FriendRequestSerializer(serializers.ModelSerializer):
    sender = MiniUserSerializer(read_only=True)
    receiver = MiniUserSerializer(read_only=True)
    receiver_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = FriendRequest
        fields = [
            "id",
            "sender",
            "receiver",
            "receiver_id",
            "status",
            "created_at",
            "responded_at",
        ]
        read_only_fields = ["id", "sender", "receiver", "status", "created_at", "responded_at"]

    def validate(self, attrs):
        request = self.context["request"]
        viewer = request.user
        receiver_id = self.initial_data.get("receiver_id")
        if not receiver_id:
            raise serializers.ValidationError({"receiver_id": "This field is required."})
        try:
            receiver = User.objects.get(pk=receiver_id)
        except ObjectDoesNotExist as exc:
            raise serializers.ValidationError({"receiver_id": "User not found."}) from exc
        if receiver == viewer:
            raise serializers.ValidationError("You cannot send a friend request to yourself.")
        if Friendship.are_friends(viewer, receiver):
            raise serializers.ValidationError("You are already friends.")
        if FriendRequest.pending_between(viewer, receiver):
            raise serializers.ValidationError("Friend request already sent.")
        if FriendRequest.pending_between(receiver, viewer):
            raise serializers.ValidationError("This user has already sent you a request.")
        attrs["sender"] = viewer
        attrs["receiver"] = receiver
        return attrs

    def create(self, validated_data):
        sender = validated_data["sender"]
        receiver = validated_data["receiver"]
        request_obj, created = FriendRequest.objects.get_or_create(
            sender=sender,
            receiver=receiver,
            defaults={"status": FriendRequest.STATUS_PENDING},
        )
        if not created:
            request_obj.status = FriendRequest.STATUS_PENDING
            request_obj.responded_at = None
            request_obj.save(update_fields=["status", "responded_at"])
        return request_obj


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Allow authentication using email by mapping the provided identifier to the user's username.
    """

    def validate(self, attrs):
        username_or_email = attrs.get(self.username_field) or attrs.get("username") or attrs.get("email")
        if username_or_email:
            UserModel = get_user_model()
            lookup = {f"{UserModel.EMAIL_FIELD}__iexact": username_or_email}
            try:
                user = UserModel.objects.get(**lookup)
                attrs["username"] = user.get_username()
            except UserModel.DoesNotExist:
                # Leave attrs untouched so default validation will raise invalid credentials
                attrs["username"] = username_or_email
        return super().validate(attrs)

