"""Chat domain models (§20).

One conversation per ride. Membership is explicit (ConversationParticipant) so
access can be granted on booking confirmation and revoked on cancellation,
independent of the ride's live booking rows.
"""
from django.conf import settings
from django.db import models

from common.models import BaseModel
from rides.models import Ride


class Conversation(BaseModel):
    ride = models.OneToOneField(
        Ride, on_delete=models.CASCADE, related_name="conversation"
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Conversation for ride {self.ride_id}"


class ConversationParticipant(BaseModel):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="participants"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chat_participations"
    )
    # Drives per-user unread counts.
    last_read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["conversation", "user"], name="uniq_participant_per_conversation"
            )
        ]

    def __str__(self) -> str:
        return f"{self.user_id} in {self.conversation_id}"


class Message(BaseModel):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_messages"
    )
    message = models.TextField()
    # Timestamp the message was first read by a recipient (§20).
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["conversation", "created_at"])]

    def __str__(self) -> str:
        return f"Message {self.id} from {self.sender_id}"
