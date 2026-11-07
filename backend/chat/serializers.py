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
    other_participants = serializers.SerializerMethodField()

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
            "other_participants",
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

    def get_other_participants(self, obj) -> list[dict]:
        """Who else is in this conversation (never includes the caller).

        A conversation is one-per-ride but can have more than two members
        (the driver plus every confirmed passenger), so this is a list, not a
        single peer — the client picks how to summarise it for display.
        """
        user = getattr(self.context.get("request"), "user", None)
        participants = (
            obj.participants.select_related("user__profile")
            .exclude(user=user)
            .order_by("created_at")
        )
        result = []
        for p in participants:
            profile = getattr(p.user, "profile", None)
            result.append(
                {
                    "id": str(p.user_id),
                    "name": profile.name if profile else "",
                    "profile_image": (
                        profile.profile_image.url
                        if profile and profile.profile_image
                        else None
                    ),
                }
            )
        return result


class SendMessageSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=2000)
