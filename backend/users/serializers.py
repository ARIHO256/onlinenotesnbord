from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import DeviceToken, User


class UserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()
    avatar = serializers.ImageField(write_only=True, required=False, allow_null=True)
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

