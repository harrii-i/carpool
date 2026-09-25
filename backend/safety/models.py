"""
Safety domain models (§25–§28).

    EmergencyContact — a student's configured contacts.
    SOSConfig        — per-student choices for what an SOS trigger does.
    SOSEvent         — an immutable record of a triggered SOS, capturing the
                       location and context at trigger time.
"""
from django.conf import settings
from django.db import models

from common.models import BaseModel

DEFAULT_SOS_MESSAGE = (
    "I may need help. I am currently on a college carpool ride. "
    "My current location is available here: {location_link}"
)


class EmergencyContact(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="emergency_contacts"
    )
    name = models.CharField(max_length=120)
    phone_number = models.CharField(max_length=20)
    relationship = models.CharField(max_length=60, blank=True, default="")
    is_primary = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-is_primary", "name"]
        constraints = [
            # At most one primary contact per user.
            models.UniqueConstraint(
                fields=["user"],
                condition=models.Q(is_primary=True),
                name="uniq_primary_contact_per_user",
            )
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.phone_number})"


class SOSConfig(BaseModel):
    """What happens when this student triggers SOS (§26). Extensible by design."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sos_config"
    )
    call_primary_contact = models.BooleanField(default=True)
    send_emergency_message = models.BooleanField(default=True)
    share_live_location = models.BooleanField(default=True)
    notify_selected_contacts = models.BooleanField(default=True)
    notify_college_security = models.BooleanField(default=False)
    custom_message = models.TextField(default=DEFAULT_SOS_MESSAGE)

    def __str__(self) -> str:
        return f"SOSConfig({self.user_id})"


class SOSStatus(models.TextChoices):
    TRIGGERED = "TRIGGERED", "Triggered"
    RESOLVED = "RESOLVED", "Resolved"
    CANCELLED = "CANCELLED", "Cancelled"


class SOSEvent(BaseModel):
    """Immutable SOS record (§27).

    ``context`` captures a snapshot (driver, vehicle, participants, tracking
    link) at trigger time so the record stays meaningful even if the ride
    changes later. Rows are never edited except for the ``status`` workflow field
    (admin review).
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="sos_events"
    )
    ride = models.ForeignKey(
        "rides.Ride", on_delete=models.SET_NULL, null=True, blank=True, related_name="sos_events"
    )
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    triggered_at = models.DateTimeField()
    status = models.CharField(
        max_length=10, choices=SOSStatus.choices, default=SOSStatus.TRIGGERED
    )
    context = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-triggered_at"]
        indexes = [models.Index(fields=["user", "status"])]

    def __str__(self) -> str:
        return f"SOSEvent({self.user_id} @ {self.triggered_at:%Y-%m-%d %H:%M})"
