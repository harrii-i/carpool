"""In-app notifications (§33)."""
from django.conf import settings
from django.db import models

from common.models import BaseModel


class NotificationType(models.TextChoices):
    RIDE_REQUEST_RECEIVED = "RIDE_REQUEST_RECEIVED", "Ride request received"
    RIDE_REQUEST_ACCEPTED = "RIDE_REQUEST_ACCEPTED", "Ride request accepted"
    RIDE_REQUEST_REJECTED = "RIDE_REQUEST_REJECTED", "Ride request rejected"
    RIDE_CANCELLED = "RIDE_CANCELLED", "Ride cancelled"
    NEW_MESSAGE = "NEW_MESSAGE", "New chat message"
    RIDE_STARTING = "RIDE_STARTING", "Ride starting"
    RIDE_COMPLETED = "RIDE_COMPLETED", "Ride completed"
    POINTS_AWARDED = "POINTS_AWARDED", "Points awarded"
    RATING_AVAILABLE = "RATING_AVAILABLE", "Rating available"


class Notification(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    type = models.CharField(max_length=32, choices=NotificationType.choices)
    title = models.CharField(max_length=150)
    message = models.TextField(blank=True, default="")
    # Free-form structured payload (e.g. {"ride_id": ...}) for client deep-links.
    data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "is_read"])]

    def __str__(self) -> str:
        return f"{self.type} -> {self.user_id}"
