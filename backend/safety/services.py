"""
Safety domain services (§25–§30).

The SOS trigger is the centrepiece: it creates an immutable event capturing the
location and context, optionally starts live-location sharing, renders a
contextual emergency message, and returns an "actions" payload describing what
the *client* should do natively (dial tel:, send SMS) — the backend never places
calls or silently sends messages (§29).
"""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from common.exceptions import NotFoundError, ValidationError
from rides.models import Booking, BookingStatus, Ride, RideStatus

from .models import EmergencyContact, SOSConfig, SOSEvent, SOSStatus


# ---------------------------------------------------------------------------
# Emergency contacts
# ---------------------------------------------------------------------------
def clear_primary(*, user, exclude_pk=None) -> None:
    """Demote every primary contact for ``user`` (optionally except one)."""
    qs = EmergencyContact.objects.filter(user=user, is_primary=True)
    if exclude_pk is not None:
        qs = qs.exclude(pk=exclude_pk)
    qs.update(is_primary=False)


@transaction.atomic
def set_primary_contact(*, contact: EmergencyContact) -> EmergencyContact:
    """Make ``contact`` the user's only primary contact."""
    clear_primary(user=contact.user, exclude_pk=contact.pk)
    if not contact.is_primary:
        contact.is_primary = True
        contact.save(update_fields=["is_primary", "updated_at"])
    return contact


# ---------------------------------------------------------------------------
# SOS config
# ---------------------------------------------------------------------------
def get_or_create_config(user) -> SOSConfig:
    config, _ = SOSConfig.objects.get_or_create(user=user)
    return config


# ---------------------------------------------------------------------------
# Message templating (§30)
# ---------------------------------------------------------------------------
class _SafeDict(dict):
    def __missing__(self, key):  # leave unknown placeholders blank
        return ""


def render_emergency_message(*, template: str, user, ride, tracking_link: str) -> str:
    profile = getattr(user, "profile", None)
    driver_profile = getattr(getattr(ride, "driver", None), "profile", None)
    variables = _SafeDict(
        name=getattr(profile, "name", "") if profile else "",
        ride=(f"{ride.origin} to {ride.destination}" if ride else ""),
        driver=getattr(driver_profile, "name", "") if driver_profile else "",
        vehicle=(f"{ride.vehicle.brand} {ride.vehicle.model}" if ride else ""),
        location_link=tracking_link,
        tracking_link=tracking_link,
    )
    try:
        return template.format_map(variables)
    except (ValueError, IndexError):
        # Malformed template (stray braces) -> return as-is rather than error.
        return template


# ---------------------------------------------------------------------------
# SOS trigger (§28)
# ---------------------------------------------------------------------------
def _find_active_ride(user) -> Ride | None:
    """The user's currently-running ride, as driver or confirmed passenger."""
    as_driver = Ride.objects.filter(driver=user, status=RideStatus.STARTED).first()
    if as_driver:
        return as_driver
    booking = (
        Booking.objects.select_related("ride")
        .filter(passenger=user, status=BookingStatus.CONFIRMED, ride__status=RideStatus.STARTED)
        .first()
    )
    return booking.ride if booking else None


def _ride_context(ride: Ride) -> dict:
    driver_profile = getattr(ride.driver, "profile", None)
    participants = list(
        ride.bookings.filter(status=BookingStatus.CONFIRMED).values_list(
            "passenger_id", flat=True
        )
    )
    return {
        "ride_id": str(ride.id),
        "origin": ride.origin,
        "destination": ride.destination,
        "driver": {
            "id": str(ride.driver_id),
            "name": getattr(driver_profile, "name", ""),
        },
        "vehicle": {
            "type": ride.vehicle.get_vehicle_type_display(),
            "brand": ride.vehicle.brand,
            "model": ride.vehicle.model,
            "registration_number": ride.vehicle.registration_number,
            "color": ride.vehicle.color,
        },
        "participant_ids": [str(pid) for pid in participants],
    }


@transaction.atomic
def trigger_sos(
    *, user, ride_id=None, latitude=None, longitude=None
) -> tuple[SOSEvent, dict]:
    """Create an SOS event and return it plus the actions the client should run."""
    config = get_or_create_config(user)

    ride = None
    if ride_id:
        ride = Ride.objects.filter(pk=ride_id).first()
        if ride is None:
            raise NotFoundError("Ride not found.", code="ride_not_found")
    else:
        ride = _find_active_ride(user)

    # Optionally start live-location sharing (§28).
    tracking_link = ""
    if config.share_live_location and ride and ride.status == RideStatus.STARTED:
        from tracking.services import build_share_url, create_share_session

        session = create_share_session(ride_id=ride.id, user=user)
        tracking_link = build_share_url(session.share_token)

    message = render_emergency_message(
        template=config.custom_message, user=user, ride=ride, tracking_link=tracking_link
    )

    context = {"tracking_link": tracking_link, "message": message}
    if ride:
        context["ride"] = _ride_context(ride)

    event = SOSEvent.objects.create(
        user=user,
        ride=ride,
        latitude=latitude,
        longitude=longitude,
        triggered_at=timezone.now(),
        status=SOSStatus.TRIGGERED,
        context=context,
    )

    actions = _build_actions(user=user, config=config, message=message, tracking_link=tracking_link)
    return event, actions


def _build_actions(*, user, config: SOSConfig, message: str, tracking_link: str) -> dict:
    """Describe the native actions the client should perform (§26, §29)."""
    contacts = list(
        EmergencyContact.objects.filter(user=user, is_active=True).values(
            "id", "name", "phone_number", "is_primary", "relationship"
        )
    )
    for contact in contacts:
        contact["id"] = str(contact["id"])

    primary = next((c for c in contacts if c["is_primary"]), None)

    actions: dict = {
        "call": None,
        "message": None,
        "recipients": [],
        "tracking_link": tracking_link,
        "notify_college_security": config.notify_college_security,
    }
    if config.call_primary_contact and primary:
        actions["call"] = {"name": primary["name"], "phone_number": primary["phone_number"]}
    if config.send_emergency_message or config.notify_selected_contacts:
        actions["message"] = message
        actions["recipients"] = contacts if config.notify_selected_contacts else (
            [primary] if primary else []
        )
    return actions


@transaction.atomic
def update_sos_status(*, event: SOSEvent, status: str) -> SOSEvent:
    if status not in {SOSStatus.RESOLVED, SOSStatus.CANCELLED}:
        raise ValidationError("Invalid SOS status.", code="invalid_status")
    event.status = status
    event.save(update_fields=["status", "updated_at"])
    return event
