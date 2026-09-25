"""
Ride domain services.

All ride lifecycle, seat-accounting, and request business rules live here so
that views stay thin and the rules are enforced in exactly one place (§37, §50).

Concurrency: any operation that changes ``available_seats`` locks the Ride row
with ``select_for_update`` inside a transaction, so simultaneous requests for
the last seat cannot oversell it (§16, §39).
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import F, QuerySet
from django.utils import timezone

from common.exceptions import (
    ConflictError,
    PermissionDeniedError,
    ValidationError,
)
from vehicles.models import Vehicle

from .models import (
    Booking,
    BookingStatus,
    Ride,
    RideRequest,
    RideRequestStatus,
    RideStatus,
)


# ---------------------------------------------------------------------------
# Ride creation
# ---------------------------------------------------------------------------
@transaction.atomic
def create_ride(
    *,
    driver,
    vehicle_id,
    origin: str,
    destination: str,
    origin_latitude: float,
    origin_longitude: float,
    destination_latitude: float,
    destination_longitude: float,
    departure_time: datetime,
    available_seats: int,
    contribution_amount: Decimal | None = None,
    notes: str = "",
) -> Ride:
    """Create a ride after enforcing the §12 validation rules."""
    try:
        vehicle = Vehicle.objects.get(pk=vehicle_id)
    except Vehicle.DoesNotExist:
        raise ValidationError("Vehicle not found.", code="vehicle_not_found")

    if vehicle.owner_id != driver.id:
        raise PermissionDeniedError("You can only create rides with your own vehicle.")
    if not vehicle.is_active:
        raise ValidationError("This vehicle is not active.", code="vehicle_inactive")

    if available_seats < 1:
        raise ValidationError("A ride must offer at least one seat.", code="no_seats")
    if available_seats > vehicle.seat_capacity:
        raise ValidationError(
            "Available seats cannot exceed the vehicle's seat capacity.",
            code="seats_exceed_capacity",
        )
    if departure_time <= timezone.now():
        raise ValidationError(
            "Departure time must be in the future.", code="departure_in_past"
        )

    ride = Ride.objects.create(
        driver=driver,
        vehicle=vehicle,
        origin=origin.strip(),
        destination=destination.strip(),
        origin_latitude=origin_latitude,
        origin_longitude=origin_longitude,
        destination_latitude=destination_latitude,
        destination_longitude=destination_longitude,
        departure_time=departure_time,
        total_seats=available_seats,
        available_seats=available_seats,
        contribution_amount=contribution_amount,
        notes=(notes or "").strip(),
        status=RideStatus.OPEN,
    )
    return ride


# ---------------------------------------------------------------------------
# Ride requests
# ---------------------------------------------------------------------------
@transaction.atomic
def request_to_join(*, ride_id, rider) -> RideRequest:
    """Create a PENDING request to join a ride, enforcing the §16 rules."""
    try:
        ride = Ride.objects.select_for_update().get(pk=ride_id)
    except Ride.DoesNotExist:
        raise ValidationError("Ride not found.", code="ride_not_found")

    if ride.driver_id == rider.id:
        raise ValidationError("You cannot request to join your own ride.", code="own_ride")
    if ride.status == RideStatus.CANCELLED:
        raise ConflictError("This ride has been cancelled.", code="ride_cancelled")
    if ride.status == RideStatus.COMPLETED:
        raise ConflictError("This ride has already been completed.", code="ride_completed")
    if ride.status in {RideStatus.FULL, RideStatus.STARTED} or ride.available_seats < 1:
        raise ConflictError("This ride has no seats available.", code="no_seats_available")

    if Booking.objects.filter(
        ride=ride, passenger=rider, status=BookingStatus.CONFIRMED
    ).exists():
        raise ConflictError("You are already booked on this ride.", code="already_booked")

    if RideRequest.objects.filter(
        ride=ride, rider=rider, status=RideRequestStatus.PENDING
    ).exists():
        raise ConflictError(
            "You already have a pending request for this ride.", code="duplicate_request"
        )

    req = RideRequest.objects.create(ride=ride, rider=rider)

    from notifications.models import NotificationType
    from notifications.services import notify_user_id

    rider_name = getattr(getattr(rider, "profile", None), "name", "A student")
    notify_user_id(
        ride.driver_id,
        NotificationType.RIDE_REQUEST_RECEIVED,
        title="New ride request",
        message=f"{rider_name} requested to join your ride to {ride.destination}.",
        data={"ride_id": str(ride.id), "request_id": str(req.id)},
    )
    return req


@transaction.atomic
def accept_request(*, request_id, driver) -> Booking:
    """Accept a pending request: create a booking and decrement seats atomically.

    Locks the ride row so two concurrent accepts cannot oversell the last seat
    (§16, §39).
    """
    try:
        req = RideRequest.objects.select_related("ride").select_for_update().get(pk=request_id)
    except RideRequest.DoesNotExist:
        raise ValidationError("Request not found.", code="request_not_found")

    ride = Ride.objects.select_for_update().get(pk=req.ride_id)

    if ride.driver_id != driver.id:
        raise PermissionDeniedError("Only the ride's driver can accept requests.")
    if req.status != RideRequestStatus.PENDING:
        raise ConflictError("This request is no longer pending.", code="request_not_pending")
    if ride.status not in {RideStatus.OPEN}:
        raise ConflictError("This ride is not accepting passengers.", code="ride_not_open")
    if ride.available_seats < 1:
        raise ConflictError("No seats remain on this ride.", code="no_seats_available")

    req.status = RideRequestStatus.ACCEPTED
    req.save(update_fields=["status", "updated_at"])

    booking = Booking.objects.create(
        ride=ride, passenger=req.rider, ride_request=req, status=BookingStatus.CONFIRMED
    )

    # Atomic seat decrement via F() to avoid read-modify-write races.
    Ride.objects.filter(pk=ride.pk).update(available_seats=F("available_seats") - 1)
    ride.refresh_from_db(fields=["available_seats"])
    if ride.available_seats <= 0:
        ride.status = RideStatus.FULL
        ride.save(update_fields=["status", "updated_at"])

    # Grant chat access to the newly-confirmed passenger (§20) and notify them.
    from chat.services import add_participant
    from notifications.models import NotificationType
    from notifications.services import notify_user_id

    add_participant(ride, req.rider)
    notify_user_id(
        req.rider_id,
        NotificationType.RIDE_REQUEST_ACCEPTED,
        title="Request accepted",
        message=f"Your seat on the ride to {ride.destination} is confirmed.",
        data={"ride_id": str(ride.id), "booking_id": str(booking.id)},
    )
    return booking


@transaction.atomic
def reject_request(*, request_id, driver) -> RideRequest:
    try:
        req = RideRequest.objects.select_related("ride").get(pk=request_id)
    except RideRequest.DoesNotExist:
        raise ValidationError("Request not found.", code="request_not_found")

    if req.ride.driver_id != driver.id:
        raise PermissionDeniedError("Only the ride's driver can reject requests.")
    if req.status != RideRequestStatus.PENDING:
        raise ConflictError("This request is no longer pending.", code="request_not_pending")

    req.status = RideRequestStatus.REJECTED
    req.save(update_fields=["status", "updated_at"])

    from notifications.models import NotificationType
    from notifications.services import notify_user_id

    notify_user_id(
        req.rider_id,
        NotificationType.RIDE_REQUEST_REJECTED,
        title="Request declined",
        message=f"Your request to join the ride to {req.ride.destination} was declined.",
        data={"ride_id": str(req.ride_id)},
    )
    return req


@transaction.atomic
def cancel_request(*, request_id, rider) -> RideRequest:
    """A rider withdraws their own still-pending request."""
    try:
        req = RideRequest.objects.get(pk=request_id)
    except RideRequest.DoesNotExist:
        raise ValidationError("Request not found.", code="request_not_found")

    if req.rider_id != rider.id:
        raise PermissionDeniedError("You can only cancel your own requests.")
    if req.status != RideRequestStatus.PENDING:
        raise ConflictError("Only pending requests can be cancelled.", code="request_not_pending")

    req.status = RideRequestStatus.CANCELLED
    req.save(update_fields=["status", "updated_at"])
    return req


# ---------------------------------------------------------------------------
# Bookings / cancellation
# ---------------------------------------------------------------------------
@transaction.atomic
def cancel_booking(*, booking_id, passenger) -> Booking:
    """A passenger cancels a confirmed booking; the seat is restored (§18)."""
    try:
        booking = Booking.objects.select_related("ride").get(pk=booking_id)
    except Booking.DoesNotExist:
        raise ValidationError("Booking not found.", code="booking_not_found")

    if booking.passenger_id != passenger.id:
        raise PermissionDeniedError("You can only cancel your own bookings.")
    if booking.status != BookingStatus.CONFIRMED:
        raise ConflictError("Only confirmed bookings can be cancelled.", code="not_confirmed")

    ride = Ride.objects.select_for_update().get(pk=booking.ride_id)
    if ride.status in {RideStatus.COMPLETED, RideStatus.CANCELLED}:
        raise ConflictError(
            "This ride can no longer be modified.", code="ride_immutable"
        )

    booking.status = BookingStatus.CANCELLED
    booking.cancelled_at = timezone.now()
    booking.save(update_fields=["status", "cancelled_at", "updated_at"])

    # Restore the seat; a FULL ride reopens.
    Ride.objects.filter(pk=ride.pk).update(available_seats=F("available_seats") + 1)
    ride.refresh_from_db(fields=["available_seats"])
    if ride.status == RideStatus.FULL and ride.available_seats > 0:
        ride.status = RideStatus.OPEN
        ride.save(update_fields=["status", "updated_at"])

    # Revoke the passenger's chat access now that they are no longer confirmed.
    from chat.services import remove_participant

    remove_participant(ride, passenger)
    return booking


# ---------------------------------------------------------------------------
# Ride lifecycle (state machine)
# ---------------------------------------------------------------------------
def _require_driver(ride: Ride, user) -> None:
    if ride.driver_id != user.id:
        raise PermissionDeniedError("Only the ride's driver can perform this action.")


@transaction.atomic
def cancel_ride(*, ride_id, driver) -> Ride:
    """Driver cancels a ride that has not yet started (§18)."""
    ride = Ride.objects.select_for_update().get(pk=ride_id)
    _require_driver(ride, driver)

    if ride.status not in {RideStatus.OPEN, RideStatus.FULL}:
        raise ConflictError(
            "Only open or full rides can be cancelled.", code="invalid_transition"
        )

    # Collect affected users before flipping statuses, so we can notify them.
    affected_ids = set(
        ride.bookings.filter(status=BookingStatus.CONFIRMED).values_list(
            "passenger_id", flat=True
        )
    ) | set(
        ride.requests.filter(status=RideRequestStatus.PENDING).values_list(
            "rider_id", flat=True
        )
    )

    ride.status = RideStatus.CANCELLED
    ride.cancelled_at = timezone.now()
    ride.save(update_fields=["status", "cancelled_at", "updated_at"])

    # Withdraw pending requests and confirmed bookings; preserve the records.
    ride.requests.filter(status=RideRequestStatus.PENDING).update(
        status=RideRequestStatus.CANCELLED
    )
    ride.bookings.filter(status=BookingStatus.CONFIRMED).update(
        status=BookingStatus.CANCELLED, cancelled_at=timezone.now()
    )

    _notify_many(
        affected_ids,
        "RIDE_CANCELLED",
        title="Ride cancelled",
        message=f"The ride to {ride.destination} was cancelled by the driver.",
        data={"ride_id": str(ride.id)},
    )
    return ride


@transaction.atomic
def start_ride(*, ride_id, driver) -> Ride:
    """OPEN/FULL -> STARTED. Only the driver, and only valid transitions (§19)."""
    ride = Ride.objects.select_for_update().get(pk=ride_id)
    _require_driver(ride, driver)

    if ride.status not in {RideStatus.OPEN, RideStatus.FULL}:
        raise ConflictError(
            "Only an open or full ride can be started.", code="invalid_transition"
        )

    ride.status = RideStatus.STARTED
    ride.started_at = timezone.now()
    ride.save(update_fields=["status", "started_at", "updated_at"])

    passenger_ids = ride.bookings.filter(status=BookingStatus.CONFIRMED).values_list(
        "passenger_id", flat=True
    )
    _notify_many(
        passenger_ids,
        "RIDE_STARTING",
        title="Ride starting",
        message=f"Your ride to {ride.destination} has started.",
        data={"ride_id": str(ride.id)},
    )
    return ride


@transaction.atomic
def complete_ride(*, ride_id, driver) -> Ride:
    """STARTED -> COMPLETED with all post-ride side effects (§19).

    Marks bookings completed and bumps completed-ride counts. Points (Phase 5),
    rating availability (Phase 5) and tracking teardown (Phase 4) hook in here
    as those apps land.
    """
    ride = Ride.objects.select_for_update().get(pk=ride_id)
    _require_driver(ride, driver)

    if ride.status != RideStatus.STARTED:
        raise ConflictError(
            "Only a started ride can be completed.", code="invalid_transition"
        )

    now = timezone.now()
    ride.status = RideStatus.COMPLETED
    ride.completed_at = now
    ride.save(update_fields=["status", "completed_at", "updated_at"])

    confirmed = list(ride.bookings.select_related("passenger").filter(
        status=BookingStatus.CONFIRMED
    ))
    ride.bookings.filter(status=BookingStatus.CONFIRMED).update(
        status=BookingStatus.COMPLETED, completed_at=now
    )

    # Reputation counters. Points are awarded by the rewards service in Phase 5;
    # this keeps the profile's completed_rides accurate now.
    _increment_completed_rides(ride.driver_id)
    for booking in confirmed:
        _increment_completed_rides(booking.passenger_id)

    participant_ids = [b.passenger_id for b in confirmed] + [ride.driver_id]
    _notify_many(
        participant_ids,
        "RIDE_COMPLETED",
        title="Ride completed",
        message=f"Your ride to {ride.destination} is complete.",
        data={"ride_id": str(ride.id)},
    )
    return ride


def _increment_completed_rides(user_id) -> None:
    from accounts.models import StudentProfile

    StudentProfile.objects.filter(user_id=user_id).update(
        completed_rides=F("completed_rides") + 1
    )


def _notify_many(user_ids, notif_type, *, title, message, data=None) -> None:
    """Send the same notification to several users (deduplicated)."""
    from notifications.services import notify_user_id

    for user_id in set(user_ids):
        notify_user_id(user_id, notif_type, title=title, message=message, data=data)


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------
def search_rides(
    *,
    user,
    origin_lat: float | None = None,
    origin_lng: float | None = None,
    destination_lat: float | None = None,
    destination_lng: float | None = None,
    radius_m: int = 5000,
    date=None,
    vehicle_type: str | None = None,
    min_seats: int = 1,
) -> QuerySet[Ride]:
    """Return bookable rides matching the given filters, nearest first (§13).

    Only future, OPEN rides with seats are returned, excluding the caller's own
    rides. When origin/destination coordinates are supplied, results are
    filtered to within ``radius_m`` of each and annotated with the origin
    distance in metres (PostGIS geography).
    """
    from django.contrib.gis.db.models.functions import Distance
    from django.contrib.gis.geos import Point
    from django.contrib.gis.measure import D

    qs = (
        Ride.objects.select_related("driver__profile", "vehicle")
        .filter(
            status=RideStatus.OPEN,
            departure_time__gte=timezone.now(),
            available_seats__gte=max(min_seats, 1),
        )
        .exclude(driver=user)
    )

    if date is not None:
        qs = qs.filter(departure_time__date=date)
    if vehicle_type:
        qs = qs.filter(vehicle__vehicle_type=vehicle_type)

    if origin_lat is not None and origin_lng is not None:
        origin_point = Point(origin_lng, origin_lat, srid=4326)
        qs = qs.filter(origin_point__dwithin=(origin_point, D(m=radius_m))).annotate(
            origin_distance_m=Distance("origin_point", origin_point)
        )
        if destination_lat is not None and destination_lng is not None:
            dest_point = Point(destination_lng, destination_lat, srid=4326)
            qs = qs.filter(destination_point__dwithin=(dest_point, D(m=radius_m)))
        qs = qs.order_by("origin_distance_m", "departure_time")
    else:
        qs = qs.order_by("departure_time")

    return qs
