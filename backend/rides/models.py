"""
Ride domain models: Ride, RideRequest, Booking.

Coordinates are stored both as plain lat/lng floats (the spec's model, and what
the mobile client sends) and as PostGIS geography points, which back proximity
search. The points are derived from the floats in ``save`` so the two never
drift.
"""
from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.contrib.gis.geos import Point
from django.db import models

from common.models import BaseModel
from vehicles.models import Vehicle


class RideStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    FULL = "FULL", "Full"
    STARTED = "STARTED", "Started"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class RideRequestStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    ACCEPTED = "ACCEPTED", "Accepted"
    REJECTED = "REJECTED", "Rejected"
    CANCELLED = "CANCELLED", "Cancelled"


class BookingStatus(models.TextChoices):
    CONFIRMED = "CONFIRMED", "Confirmed"
    CANCELLED = "CANCELLED", "Cancelled"
    COMPLETED = "COMPLETED", "Completed"


class Ride(BaseModel):
    driver = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="rides_offered"
    )
    vehicle = models.ForeignKey(
        Vehicle, on_delete=models.PROTECT, related_name="rides"
    )

    origin = models.CharField(max_length=255)
    destination = models.CharField(max_length=255)

    origin_latitude = models.FloatField()
    origin_longitude = models.FloatField()
    destination_latitude = models.FloatField()
    destination_longitude = models.FloatField()

    # Geography points (SRID 4326) power proximity search; distances are metres.
    origin_point = gis_models.PointField(geography=True, srid=4326, null=True, blank=True)
    destination_point = gis_models.PointField(
        geography=True, srid=4326, null=True, blank=True
    )

    departure_time = models.DateTimeField(db_index=True)

    total_seats = models.PositiveSmallIntegerField()
    available_seats = models.PositiveSmallIntegerField()

    contribution_amount = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True
    )
    notes = models.TextField(blank=True, default="")

    status = models.CharField(
        max_length=10, choices=RideStatus.choices, default=RideStatus.OPEN, db_index=True
    )

    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["departure_time"]
        indexes = [
            models.Index(fields=["status", "departure_time"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(available_seats__lte=models.F("total_seats")),
                name="available_seats_lte_total",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.origin} -> {self.destination} @ {self.departure_time:%Y-%m-%d %H:%M}"

    def save(self, *args, **kwargs):
        # Keep the geography points in sync with the lat/lng source of truth.
        # PostGIS Point takes (x=lng, y=lat).
        self.origin_point = Point(self.origin_longitude, self.origin_latitude, srid=4326)
        self.destination_point = Point(
            self.destination_longitude, self.destination_latitude, srid=4326
        )
        super().save(*args, **kwargs)

    @property
    def is_active(self) -> bool:
        return self.status in {RideStatus.OPEN, RideStatus.FULL, RideStatus.STARTED}


class RideRequest(BaseModel):
    ride = models.ForeignKey(Ride, on_delete=models.CASCADE, related_name="requests")
    rider = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ride_requests"
    )
    status = models.CharField(
        max_length=10,
        choices=RideRequestStatus.choices,
        default=RideRequestStatus.PENDING,
        db_index=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["ride", "status"]),
            models.Index(fields=["rider", "status"]),
        ]
        constraints = [
            # At most one live (pending) request per rider per ride. Prevents
            # duplicate active requests at the database level (§16).
            models.UniqueConstraint(
                fields=["ride", "rider"],
                condition=models.Q(status="PENDING"),
                name="uniq_pending_request_per_rider_ride",
            ),
        ]

    def __str__(self) -> str:
        return f"Request({self.rider_id} -> ride {self.ride_id}: {self.status})"


class Booking(BaseModel):
    ride = models.ForeignKey(Ride, on_delete=models.CASCADE, related_name="bookings")
    passenger = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bookings"
    )
    ride_request = models.OneToOneField(
        RideRequest, on_delete=models.SET_NULL, null=True, blank=True, related_name="booking"
    )
    status = models.CharField(
        max_length=10, choices=BookingStatus.choices, default=BookingStatus.CONFIRMED
    )

    cancelled_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["ride", "status"]),
            models.Index(fields=["passenger", "status"]),
        ]
        constraints = [
            # A passenger holds at most one confirmed booking on a given ride.
            models.UniqueConstraint(
                fields=["ride", "passenger"],
                condition=models.Q(status="CONFIRMED"),
                name="uniq_confirmed_booking_per_passenger_ride",
            ),
        ]

    def __str__(self) -> str:
        return f"Booking({self.passenger_id} on ride {self.ride_id}: {self.status})"
