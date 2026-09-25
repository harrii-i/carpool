"""
Live-tracking models (§21–§24).

RideShareSession is the *authorization* object for a public tracking link: a
cryptographically random token that expires, can be revoked, and dies when the
ride ends. The ride id / student id are never used as the public authorization
mechanism (§21).

Live location itself is NOT stored here per update — the current position lives
in Redis (see services). LocationSnapshot optionally persists coarse, throttled
points so PostgreSQL never becomes a high-frequency GPS event store (§24).
"""
import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone

from common.models import BaseModel
from rides.models import Ride


def generate_share_token() -> str:
    """A URL-safe, unguessable token for public tracking links (§21, §43)."""
    return secrets.token_urlsafe(32)


class RideShareSession(BaseModel):
    ride = models.ForeignKey(
        Ride, on_delete=models.CASCADE, related_name="share_sessions"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="share_sessions"
    )
    share_token = models.CharField(
        max_length=64, unique=True, db_index=True, default=generate_share_token
    )
    expires_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["share_token", "is_active"])]

    def __str__(self) -> str:
        return f"ShareSession({self.share_token[:8]}… ride={self.ride_id})"

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    def is_live(self) -> bool:
        """Valid for viewing: active, unexpired, and the ride still running."""
        from rides.models import RideStatus

        return (
            self.is_active
            and not self.is_expired
            and self.ride.status not in {RideStatus.COMPLETED, RideStatus.CANCELLED}
        )


class LocationSnapshot(BaseModel):
    """Coarse, throttled location history (optional persistence, §24)."""

    ride = models.ForeignKey(
        Ride, on_delete=models.CASCADE, related_name="location_snapshots"
    )
    latitude = models.FloatField()
    longitude = models.FloatField()
    speed = models.FloatField(null=True, blank=True)
    heading = models.FloatField(null=True, blank=True)
    recorded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-recorded_at"]
        indexes = [models.Index(fields=["ride", "recorded_at"])]
