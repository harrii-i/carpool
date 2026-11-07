"""
Reputation services (§31, §32).

Points are awarded only by trusted backend logic after ride completion — never
by the client (§31). Award is idempotent via a unique (user, ride, type)
constraint, so re-running completion cannot double-credit. Rating averages are
computed here and mirrored onto StudentProfile.
"""
from __future__ import annotations

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Avg, F

from common.exceptions import ConflictError, PermissionDeniedError, ValidationError
from rides.models import Booking, BookingStatus, Ride, RideStatus

from .models import PointsTransaction, PointsTransactionType, Rating


# ---------------------------------------------------------------------------
# Participants
# ---------------------------------------------------------------------------
def ride_participant_ids(ride: Ride) -> set:
    """Driver + all passengers with a confirmed/completed booking."""
    passengers = set(
        ride.bookings.filter(
            status__in=[BookingStatus.CONFIRMED, BookingStatus.COMPLETED]
        ).values_list("passenger_id", flat=True)
    )
    passengers.add(ride.driver_id)
    return passengers


# ---------------------------------------------------------------------------
# Points
# ---------------------------------------------------------------------------
def _award(user_id, ride, points: int, tx_type: str, description: str) -> None:
    """Create a points transaction and bump the mirrored profile total.

    Uses the unique constraint to stay idempotent: a duplicate award is skipped.
    """
    from accounts.models import StudentProfile

    try:
        with transaction.atomic():
            PointsTransaction.objects.create(
                user_id=user_id,
                ride=ride,
                points=points,
                transaction_type=tx_type,
                description=description,
            )
    except IntegrityError:
        return  # already awarded for this (user, ride, type)

    StudentProfile.objects.filter(user_id=user_id).update(
        total_points=F("total_points") + points
    )
    from notifications.services import notify_user_id
    from notifications.models import NotificationType

    notify_user_id(
        user_id,
        NotificationType.POINTS_AWARDED,
        title="Points awarded",
        message=f"You earned {points} points for completing a ride.",
        data={"ride_id": str(ride.id), "points": points},
    )


def award_points_for_ride(ride: Ride) -> None:
    """Award completion points to the driver and each confirmed passenger (§31)."""
    _award(
        ride.driver_id,
        ride,
        settings.POINTS_DRIVER_COMPLETE,
        PointsTransactionType.DRIVER_COMPLETION,
        "Completed a ride as driver",
    )
    passenger_ids = ride.bookings.filter(
        status__in=[BookingStatus.CONFIRMED, BookingStatus.COMPLETED]
    ).values_list("passenger_id", flat=True)
    for pid in passenger_ids:
        _award(
            pid,
            ride,
            settings.POINTS_PASSENGER_COMPLETE,
            PointsTransactionType.PASSENGER_COMPLETION,
            "Completed a ride as passenger",
        )


# ---------------------------------------------------------------------------
# Ratings
# ---------------------------------------------------------------------------
@transaction.atomic
def create_rating(*, ride_id, reviewer, reviewee_id, rating: int, comment: str = "") -> Rating:
    """Create a rating with the §32 rules enforced."""
    try:
        ride = Ride.objects.get(pk=ride_id)
    except Ride.DoesNotExist:
        raise ValidationError("Ride not found.", code="ride_not_found")

    if ride.status != RideStatus.COMPLETED:
        raise ConflictError("You can only rate after the ride is completed.", code="ride_not_completed")

    if str(reviewee_id) == str(reviewer.id):
        raise ValidationError("You cannot rate yourself.", code="self_rating")

    participants = ride_participant_ids(ride)
    if reviewer.id not in participants:
        raise PermissionDeniedError("Only ride participants can leave ratings.")
    if reviewee_id not in participants:
        raise ValidationError("That person was not part of this ride.", code="reviewee_not_participant")

    if Rating.objects.filter(ride=ride, reviewer=reviewer, reviewee_id=reviewee_id).exists():
        raise ConflictError("You have already rated this person for this ride.", code="already_rated")

    rating_obj = Rating.objects.create(
        ride=ride,
        reviewer=reviewer,
        reviewee_id=reviewee_id,
        rating=rating,
        comment=(comment or "").strip(),
    )
    recompute_average(reviewee_id)
    return rating_obj


def recompute_average(user_id) -> None:
    """Recompute and store a user's average rating (§32)."""
    from accounts.models import StudentProfile

    avg = (
        Rating.objects.filter(reviewee_id=user_id).aggregate(a=Avg("rating"))["a"] or 0
    )
    StudentProfile.objects.filter(user_id=user_id).update(average_rating=round(avg, 2))


def rateable_participants(*, ride: Ride, reviewer) -> list[dict]:
    """Who the reviewer can still rate for a completed ride."""
    if ride.status != RideStatus.COMPLETED:
        return []
    participants = ride_participant_ids(ride)
    already = set(
        Rating.objects.filter(ride=ride, reviewer=reviewer).values_list(
            "reviewee_id", flat=True
        )
    )
    from accounts.models import StudentProfile

    result = []
    for pid in participants:
        if pid == reviewer.id:
            continue
        profile = StudentProfile.objects.filter(user_id=pid).first()
        result.append(
            {
                "user_id": str(pid),
                "name": profile.name if profile else "",
                "role": "driver" if pid == ride.driver_id else "passenger",
                "already_rated": pid in already,
            }
        )
    return result
