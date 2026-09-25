"""
Tracking domain services (§21–§24).

Current location is kept in the cache (Redis in prod) under a per-token key with
a short TTL, so it naturally goes "stale" and is never a permanent GPS store.
Updates fan out to the token's WebSocket group; snapshots are persisted at most
once per ``TRACKING_SNAPSHOT_INTERVAL_SECONDS``.
"""
from __future__ import annotations

import logging
from datetime import timedelta

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from common.exceptions import (
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)
from rides.models import Ride, RideStatus

from .models import LocationSnapshot, RideShareSession

logger = logging.getLogger(__name__)


def tracking_group(token: str) -> str:
    return f"tracking_{token}"


def _location_key(token: str) -> str:
    return f"tracking:location:{token}"


def _snapshot_stamp_key(ride_id) -> str:
    return f"tracking:snapshot_at:{ride_id}"


def _is_ride_participant(ride: Ride, user) -> bool:
    from rides.models import Booking, BookingStatus

    if ride.driver_id == user.id:
        return True
    return Booking.objects.filter(
        ride=ride, passenger=user, status=BookingStatus.CONFIRMED
    ).exists()


# ---------------------------------------------------------------------------
# Share sessions
# ---------------------------------------------------------------------------
@transaction.atomic
def create_share_session(*, ride_id, user) -> RideShareSession:
    """Create a public share link for a ride the user participates in (§21)."""
    try:
        ride = Ride.objects.get(pk=ride_id)
    except Ride.DoesNotExist:
        raise NotFoundError("Ride not found.", code="ride_not_found")

    if ride.status in {RideStatus.COMPLETED, RideStatus.CANCELLED}:
        raise ValidationError(
            "You can only share a live ride.", code="ride_not_live"
        )
    if not _is_ride_participant(ride, user):
        raise PermissionDeniedError("Only ride participants can share this ride.")

    return RideShareSession.objects.create(
        ride=ride,
        created_by=user,
        expires_at=timezone.now() + timedelta(hours=settings.SHARE_SESSION_TTL_HOURS),
    )


def revoke_share_session(*, session_id, user) -> RideShareSession:
    try:
        session = RideShareSession.objects.get(pk=session_id)
    except RideShareSession.DoesNotExist:
        raise NotFoundError("Share session not found.", code="session_not_found")

    # The creator or the ride driver may revoke.
    if session.created_by_id != user.id and session.ride.driver_id != user.id:
        raise PermissionDeniedError("You cannot revoke this share session.")

    _deactivate(session)
    return session


def end_sessions_for_ride(ride) -> None:
    """End all active share sessions for a ride (called on complete/cancel, §19)."""
    for session in ride.share_sessions.filter(is_active=True):
        _deactivate(session)


def _deactivate(session: RideShareSession) -> None:
    session.is_active = False
    session.ended_at = timezone.now()
    session.save(update_fields=["is_active", "ended_at", "updated_at"])
    cache.delete(_location_key(session.share_token))
    # Tell any connected viewers the session has ended.
    _group_send(session.share_token, {"type": "tracking_ended", "payload": {"reason": "ended"}})


def get_live_session(token: str) -> RideShareSession:
    """Resolve a token to a live session, or raise a specific error (§22)."""
    session = (
        RideShareSession.objects.select_related("ride__driver__profile", "ride__vehicle")
        .filter(share_token=token)
        .first()
    )
    if session is None:
        raise NotFoundError("Invalid tracking link.", code="invalid_token")
    if not session.is_active or session.ended_at is not None:
        raise PermissionDeniedError("This tracking link has been revoked.", code="revoked")
    if session.is_expired:
        raise PermissionDeniedError("This tracking link has expired.", code="expired")
    if session.ride.status in {RideStatus.COMPLETED, RideStatus.CANCELLED}:
        raise PermissionDeniedError("This ride has ended.", code="ride_ended")
    return session


# ---------------------------------------------------------------------------
# Live location
# ---------------------------------------------------------------------------
def record_location(
    *, token: str, latitude: float, longitude: float, speed=None, heading=None, timestamp=None
) -> dict:
    """Store the latest location in the cache, broadcast it, and throttle-persist.

    Only the ride's driver may push updates (enforced by the caller/consumer).
    """
    session = get_live_session(token)

    payload = {
        "latitude": latitude,
        "longitude": longitude,
        "speed": speed,
        "heading": heading,
        "timestamp": (timestamp or timezone.now()).isoformat()
        if not isinstance(timestamp, str)
        else timestamp,
        "updated_at": timezone.now().isoformat(),
        "ride_status": session.ride.status,
    }

    cache.set(
        _location_key(token), payload, timeout=settings.TRACKING_LOCATION_TTL_SECONDS
    )
    _group_send(token, {"type": "location_update", "payload": payload})
    _maybe_snapshot(session.ride_id, latitude, longitude, speed, heading)
    return payload


def get_current_location(token: str) -> dict | None:
    return cache.get(_location_key(token))


def _maybe_snapshot(ride_id, latitude, longitude, speed, heading) -> None:
    """Persist a coarse snapshot at most once per configured interval (§24)."""
    interval = settings.TRACKING_SNAPSHOT_INTERVAL_SECONDS
    stamp_key = _snapshot_stamp_key(ride_id)
    if cache.get(stamp_key):
        return  # a snapshot was taken recently
    cache.set(stamp_key, True, timeout=interval)
    try:
        LocationSnapshot.objects.create(
            ride_id=ride_id,
            latitude=latitude,
            longitude=longitude,
            speed=speed,
            heading=heading,
        )
    except Exception:  # pragma: no cover - persistence is best-effort
        logger.exception("Failed to persist location snapshot for ride %s", ride_id)


# ---------------------------------------------------------------------------
# Public payload (no private student data, §22/§43)
# ---------------------------------------------------------------------------
def public_track_payload(token: str) -> dict:
    session = get_live_session(token)
    ride = session.ride
    profile = getattr(ride.driver, "profile", None)
    vehicle = ride.vehicle

    return {
        "driver": {
            # First name only; no email/phone/admission number are exposed.
            "name": (profile.name.split(" ")[0] if profile and profile.name else "Driver"),
        },
        "vehicle": {
            "type": vehicle.get_vehicle_type_display(),
            "brand": vehicle.brand,
            "model": vehicle.model,
            "color": vehicle.color,
        },
        "origin": ride.origin,
        "destination": ride.destination,
        "ride_status": ride.status,
        "current_location": get_current_location(token),
        "expires_at": session.expires_at.isoformat(),
    }


def build_share_url(token: str) -> str:
    return f"{settings.SHARE_LINK_BASE_URL.rstrip('/')}/{token}"


# ---------------------------------------------------------------------------
# Channel-layer helper
# ---------------------------------------------------------------------------
def _group_send(token: str, message: dict) -> None:
    layer = get_channel_layer()
    if layer is None:
        return
    try:
        async_to_sync(layer.group_send)(tracking_group(token), message)
    except Exception:  # pragma: no cover
        logger.exception("Failed to broadcast tracking update for %s", token)
