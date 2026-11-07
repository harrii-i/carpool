"""User / ride reporting (§36). Reviewed via Django Admin."""
from django.conf import settings
from django.db import models

from common.models import BaseModel


class ReportReason(models.TextChoices):
    UNSAFE_BEHAVIOR = "UNSAFE_BEHAVIOR", "Unsafe behavior"
    HARASSMENT = "HARASSMENT", "Harassment"
    FAKE_PROFILE = "FAKE_PROFILE", "Fake profile"
    VEHICLE_MISMATCH = "VEHICLE_MISMATCH", "Vehicle mismatch"
    INAPPROPRIATE_BEHAVIOR = "INAPPROPRIATE_BEHAVIOR", "Inappropriate behavior"
    OTHER = "OTHER", "Other"


class ReportStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    REVIEWING = "REVIEWING", "Reviewing"
    RESOLVED = "RESOLVED", "Resolved"
    DISMISSED = "DISMISSED", "Dismissed"


class Report(BaseModel):
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reports_made"
    )
    reported_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reports_received",
    )
    ride = models.ForeignKey(
        "rides.Ride", on_delete=models.SET_NULL, null=True, blank=True, related_name="reports"
    )
    reason = models.CharField(max_length=32, choices=ReportReason.choices)
    description = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=10, choices=ReportStatus.choices, default=ReportStatus.PENDING, db_index=True
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "created_at"])]

    def __str__(self) -> str:
        return f"Report({self.reason}) by {self.reporter_id}"
