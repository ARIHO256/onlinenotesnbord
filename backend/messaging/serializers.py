from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from notices.models import Notice
from users.models import Friendship
from users.serializers import MiniUserSerializer

from .models import Conversation, ConversationMessage

User = get_user_model()


class ConversationMessageSerializer(serializers.ModelSerializer):
    sender = MiniUserSerializer(read_only=True)
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = ConversationMessage
        fields = ["id", "conversation", "sender", "content", "created_at", "read_at", "is_mine"]
        read_only_fields = ["id", "conversation", "sender", "created_at", "read_at", "is_mine"]

    def get_is_mine(self, obj):
        request = self.context.get("request")
        return bool(request and request.user.id == obj.sender_id)


class ConversationSerializer(serializers.ModelSerializer):
    other_user = serializers.SerializerMethodField()
    notice_title = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id",
            "notice",
            "notice_title",
            "other_user",
            "last_message_preview",
            "last_message_by",
            "last_message_at",
            "unread_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_other_user(self, obj):
        request = self.context.get("request")
        other = obj.other_user(getattr(request, "user", None))
        if not other:
            return None
        serializer = MiniUserSerializer(other, context=self.context)
        return serializer.data

    def get_notice_title(self, obj):
        if obj.notice:
            return obj.notice.title
        return None

    def get_unread_count(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user:
            return 0
        return obj.messages.filter(read_at__isnull=True).exclude(sender=user).count()


class ConversationCreateSerializer(serializers.Serializer):
    recipient_id = serializers.IntegerField(required=False)
    notice_id = serializers.IntegerField(required=False)
    first_message = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate(self, attrs):
        request = self.context["request"]
        user = request.user
        recipient = None
        notice = None

        notice_id = attrs.get("notice_id")
        recipient_id = attrs.get("recipient_id")

        if notice_id:
            try:
                notice = Notice.objects.select_related("created_by").get(pk=notice_id)
            except Notice.DoesNotExist as exc:
                raise serializers.ValidationError({"notice_id": "Notice not found."}) from exc
            recipient = notice.created_by
        elif recipient_id:
            try:
                recipient = User.objects.get(pk=recipient_id)
            except User.DoesNotExist as exc:
                raise serializers.ValidationError({"recipient_id": "User not found."}) from exc
        else:
            raise serializers.ValidationError("A notice_id or recipient_id is required.")

        if recipient == user:
            raise serializers.ValidationError("You cannot start a conversation with yourself.")
        if not Friendship.are_friends(user, recipient):
            raise serializers.ValidationError("You can only message friends once requests are accepted.")

        attrs["recipient"] = recipient
        attrs["notice"] = notice
        return attrs

    @transaction.atomic
    def save_with_status(self):
        if not self.is_valid():
            raise AssertionError("You must call is_valid before save_with_status")
        data = self.validated_data
        user = self.context["request"].user
        recipient = data["recipient"]
        notice = data.get("notice")

        user_a, user_b = sorted([user, recipient], key=lambda u: u.pk)
        conversation, created = Conversation.objects.get_or_create(
            user_a=user_a,
            user_b=user_b,
            notice=notice,
        )

        first_message = data.get("first_message")
        if first_message and first_message.strip():
            message_text = first_message.strip()
            msg = ConversationMessage.objects.create(
                conversation=conversation,
                sender=user,
                content=message_text,
            )
            conversation.last_message_preview = msg.content[:280]
            conversation.last_message_by = user
            conversation.last_message_at = msg.created_at
            conversation.save(update_fields=["last_message_preview", "last_message_by", "last_message_at", "updated_at"])
        return conversation, created


class MessageCreateSerializer(serializers.Serializer):
    content = serializers.CharField()

    def validate_content(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Message content cannot be empty.")
        return value.strip()

    def create(self, validated_data):
        request = self.context["request"]
        conversation: Conversation = self.context["conversation"]
        user = request.user
        other_user = conversation.other_user(user)
        if not Friendship.are_friends(user, other_user):
            raise serializers.ValidationError("You can only message friends.")
        message = ConversationMessage.objects.create(
            conversation=conversation,
            sender=user,
            content=validated_data["content"],
        )
        conversation.last_message_preview = message.content[:280]
        conversation.last_message_by = user
        conversation.last_message_at = message.created_at
        conversation.save(update_fields=["last_message_preview", "last_message_by", "last_message_at", "updated_at"])
        return message
