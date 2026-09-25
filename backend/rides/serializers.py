"""Serializers for rides, requests, and bookings.

These shape input/output only; business rules live in ``services``. Private
fields (exact registration number, phone) are exposed only where §13/§14 permit.
"""
from __future__ import annotations

from rest_framework import serializers

from vehicles.serializers import VehicleSummarySerializer

from .models import Booking, Ride, RideRequest


class DriverSummarySerializer(serializers.Serializer):
    """Public-facing driver summary for search/detail (§13, §14)."""

    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(source="profile.name", read_only=True)
    department = serializers.CharField(source="profile.department", read_only=True)
    year = serializers.IntegerField(source="profile.year", read_only=True)
    profile_image = serializers.ImageField(source="profile.profile_image", read_only=True)
    average_rating = serializers.DecimalField(
        source="profile.average_rating", max_digits=3, decimal_places=2, read_only=True
    )
    completed_rides = serializers.IntegerField(
        source="profile.completed_rides", read_only=True
    )


class RideCreateSerializer(serializers.Serializer):
    """Input for POST /api/rides/ (§12). Identity/status are not client-set."""

    vehicle_id = serializers.UUIDField()
    origin = serializers.CharField(max_length=255)
    destination = serializers.CharField(max_length=255)
    origin_latitude = serializers.FloatField(min_value=-90, max_value=90)
    origin_longitude = serializers.FloatField(min_value=-180, max_value=180)
    destination_latitude = serializers.FloatField(min_value=-90, max_value=90)
    destination_longitude = serializers.FloatField(min_value=-180, max_value=180)
    departure_time = serializers.DateTimeField()
    available_seats = serializers.IntegerField(min_value=1, max_value=8)
    contribution_amount = serializers.DecimalField(
        max_digits=8, decimal_places=2, required=False, allow_null=True, min_value=0
    )
    notes = serializers.CharField(
        required=False, allow_blank=True, default="", max_length=1000
    )


class RideListSerializer(serializers.ModelSerializer):
    """Compact ride for search results / lists (§13)."""

    driver = DriverSummarySerializer(read_only=True)
    vehicle = VehicleSummarySerializer(read_only=True)
    distance_m = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()

    class Meta:
        model = Ride
        fields = [
            "id",
            "driver",
            "vehicle",
            "origin",
            "destination",
            "departure_time",
            "available_seats",
            "total_seats",
            "contribution_amount",
            "status",
            "distance_m",
            "role",
        ]

    def get_distance_m(self, obj) -> float | None:
        distance = getattr(obj, "origin_distance_m", None)
        return round(distance.m, 1) if distance is not None else None

    def get_role(self, obj) -> str | None:
        """The caller's role on this ride, for history views (§34)."""
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return None
        return "driver" if obj.driver_id == user.id else "passenger"


class RideDetailSerializer(serializers.ModelSerializer):
    """Full ride detail (§14)."""

    driver = DriverSummarySerializer(read_only=True)
    vehicle = VehicleSummarySerializer(read_only=True)
    is_driver = serializers.SerializerMethodField()
    my_request_status = serializers.SerializerMethodField()
    my_booking_status = serializers.SerializerMethodField()

    class Meta:
        model = Ride
        fields = [
            "id",
            "driver",
            "vehicle",
            "origin",
            "destination",
            "origin_latitude",
            "origin_longitude",
            "destination_latitude",
            "destination_longitude",
            "departure_time",
            "total_seats",
            "available_seats",
            "contribution_amount",
            "notes",
            "status",
            "started_at",
            "completed_at",
            "cancelled_at",
            "created_at",
            "is_driver",
            "my_request_status",
            "my_booking_status",
        ]

    def _user(self):
        request = self.context.get("request")
        return getattr(request, "user", None)

    def get_is_driver(self, obj) -> bool:
        user = self._user()
        return bool(user and obj.driver_id == user.id)

    def get_my_request_status(self, obj) -> str | None:
        user = self._user()
        if not user:
            return None
        req = (
            obj.requests.filter(rider=user)
            .order_by("-created_at")
            .values_list("status", flat=True)
            .first()
        )
        return req

    def get_my_booking_status(self, obj) -> str | None:
        user = self._user()
        if not user:
            return None
        return (
            obj.bookings.filter(passenger=user)
            .order_by("-created_at")
            .values_list("status", flat=True)
            .first()
        )


class RideRequestSerializer(serializers.ModelSerializer):
    rider = DriverSummarySerializer(read_only=True)
    ride = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = RideRequest
        fields = ["id", "ride", "rider", "status", "created_at", "updated_at"]
        read_only_fields = fields


class RideRequestCreateSerializer(serializers.Serializer):
    ride_id = serializers.UUIDField()


class BookingSerializer(serializers.ModelSerializer):
    ride = RideListSerializer(read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id",
            "ride",
            "status",
            "created_at",
            "cancelled_at",
            "completed_at",
        ]
        read_only_fields = fields
