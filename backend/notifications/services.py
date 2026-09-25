"""
Notification service (§33).

``notify`` is the single entry point other apps call. It persists an in-app
notification, pushes it to the user's live WebSocket group, and (best-effort)
enqueues an Expo push. Callers never construct Notification rows directly.
"""
from __future__ import annotations

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import Notification, NotificationType

logger = logging.getLogger(__name__)


def user_group(user_id) -> str:
    """Channel-layer group a user's own live events are broadcast to."""
    return f"notifications_{user_id}"


def notify(user, notif_type: str, title: str, message: str = "", data: dict | None = None) -> Notification:
    notification = Notification.objects.create(
        user=user,
        type=notif_type,
        title=title,
        message=message,
        data=data or {},
    )
    _broadcast(notification)
    _send_push(notification)
    return notification


def notify_user_id(user_id, notif_type: str, title: str, message: str = "", data: dict | None = None):
    """Variant when only the user id is on hand (avoids an extra query in callers)."""
    from accounts.models import User

    user = User.objects.filter(pk=user_id).first()
    if user:
        return notify(user, notif_type, title, message, data)
    return None


def _broadcast(notification: Notification) -> None:
    """Push the notification to the user's live WebSocket group, if connected."""
    layer = get_channel_layer()
    if layer is None:
        return
    try:
        async_to_sync(layer.group_send)(
            user_group(notification.user_id),
            {
                "type": "notify",  # -> NotificationConsumer.notify
                "payload": {
                    "id": str(notification.id),
                    "type": notification.type,
                    "title": notification.title,
                    "message": notification.message,
                    "data": notification.data,
                    "is_read": notification.is_read,
                    "created_at": notification.created_at.isoformat(),
                },
            },
        )
    except Exception:  # pragma: no cover - transport errors must not break the request
        logger.exception("Failed to broadcast notification %s", notification.id)


def _send_push(notification: Notification) -> None:
    """Best-effort Expo push hook.

    Wired to Expo's push API in a later pass; kept as a no-op seam so the
    notification pipeline is complete and callers don't change (§33).
    """
    return None
