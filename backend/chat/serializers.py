from rest_framework import serializers

from .models import Conversation, Message
from .services import unread_count


class MessageSerializer(serializers.ModelSerializer):
    sender_id = serializers.UUIDField(read_only=True)
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ["id", "conversation", "sender_id", "message", "is_mine", "created_at", "read_at"]
        read_only_fields = fields

    def get_is_mine(self, obj) -> bool:
        user = getattr(self.context.get("request"), "user", None)
        return bool(user and obj.sender_id == user.id)


class ConversationSerializer(serializers.ModelSerializer):
    ride_id = serializers.UUIDField(read_only=True)
    origin = serializers.CharField(source="ride.origin", read_only=True)
    destination = serializers.CharField(source="ride.destination", read_only=True)
    ride_status = serializers.CharField(source="ride.status", read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id",
            "ride_id",
            "origin",
            "destination",
            "ride_status",
            "last_message",
            "unread_count",
            "created_at",
        ]

    def get_last_message(self, obj):
        message = obj.messages.order_by("-created_at").first()
        return MessageSerializer(message, context=self.context).data if message else None

    def get_unread_count(self, obj) -> int:
        user = getattr(self.context.get("request"), "user", None)
        if not user:
            return 0
        return unread_count(conversation_id=obj.id, user=user)


class SendMessageSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=2000)
