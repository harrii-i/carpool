"""
Chat domain services (§20).

Conversations are created lazily when the first booking on a ride is confirmed,
with the driver and that passenger as participants. Sending a message persists
it, broadcasts it to the live WebSocket group, and notifies the other
participants.
"""
from __future__ import annotations

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.utils import timezone

from common.exceptions import PermissionDeniedError, ValidationError
from notifications.models import NotificationType
from notifications.services import notify

from .models import Conversation, ConversationParticipant, Message

logger = logging.getLogger(__name__)


def conversation_group(conversation_id) -> str:
    return f"chat_{conversation_id}"


def ensure_conversation(ride) -> Conversation:
    """Get or create the ride's conversation, ensuring the driver is a member."""
    conversation, _ = Conversation.objects.get_or_create(ride=ride)
    ConversationParticipant.objects.get_or_create(
        conversation=conversation, user_id=ride.driver_id
    )
    return conversation


def add_participant(ride, user) -> ConversationParticipant:
    """Add a confirmed passenger to the ride's conversation (§20)."""
    conversation = ensure_conversation(ride)
    participant, _ = ConversationParticipant.objects.get_or_create(
        conversation=conversation, user=user
    )
    return participant


def remove_participant(ride, user) -> None:
    """Revoke chat access, e.g. when a passenger cancels their booking."""
    conversation = Conversation.objects.filter(ride=ride).first()
    if conversation:
        ConversationParticipant.objects.filter(
            conversation=conversation, user=user
        ).delete()


def is_participant(conversation_id, user_id) -> bool:
    return ConversationParticipant.objects.filter(
        conversation_id=conversation_id, user_id=user_id
    ).exists()


@transaction.atomic
def create_message(*, conversation_id, sender, text: str) -> Message:
    """Persist a message from a confirmed participant and fan it out."""
    text = (text or "").strip()
    if not text:
        raise ValidationError("Message cannot be empty.", code="empty_message")

    conversation = Conversation.objects.select_related("ride").get(pk=conversation_id)
    if not is_participant(conversation_id, sender.id):
        raise PermissionDeniedError("You are not a participant in this conversation.")

    message = Message.objects.create(
        conversation=conversation, sender=sender, message=text
    )
    _broadcast_message(message)
    _notify_others(conversation, message)
    return message


def mark_read(*, conversation_id, user) -> int:
    """Mark the conversation read for ``user``; returns messages newly read."""
    if not is_participant(conversation_id, user.id):
        raise PermissionDeniedError("You are not a participant in this conversation.")

    now = timezone.now()
    ConversationParticipant.objects.filter(
        conversation_id=conversation_id, user=user
    ).update(last_read_at=now)

    return (
        Message.objects.filter(conversation_id=conversation_id, read_at__isnull=True)
        .exclude(sender=user)
        .update(read_at=now)
    )


def unread_count(*, conversation_id, user) -> int:
    participant = ConversationParticipant.objects.filter(
        conversation_id=conversation_id, user=user
    ).first()
    if participant is None:
        return 0
    qs = Message.objects.filter(conversation_id=conversation_id).exclude(sender=user)
    if participant.last_read_at:
        qs = qs.filter(created_at__gt=participant.last_read_at)
    return qs.count()


def _broadcast_message(message: Message) -> None:
    layer = get_channel_layer()
    if layer is None:
        return
    try:
        async_to_sync(layer.group_send)(
            conversation_group(message.conversation_id),
            {"type": "chat_message", "payload": serialize_message(message)},
        )
    except Exception:  # pragma: no cover
        logger.exception("Failed to broadcast message %s", message.id)


def _notify_others(conversation: Conversation, message: Message) -> None:
    others = (
        ConversationParticipant.objects.filter(conversation=conversation)
        .exclude(user=message.sender)
        .select_related("user")
    )
    sender_name = getattr(getattr(message.sender, "profile", None), "name", "Someone")
    for participant in others:
        notify(
            participant.user,
            NotificationType.NEW_MESSAGE,
            title=f"New message from {sender_name}",
            message=message.message[:120],
            data={
                "conversation_id": str(conversation.id),
                "ride_id": str(conversation.ride_id),
            },
        )


def serialize_message(message: Message) -> dict:
    return {
        "id": str(message.id),
        "conversation_id": str(message.conversation_id),
        "sender_id": str(message.sender_id),
        "message": message.message,
        "created_at": message.created_at.isoformat(),
        "read_at": message.read_at.isoformat() if message.read_at else None,
    }
