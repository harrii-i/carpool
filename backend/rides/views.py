"""Ride, ride-request, and booking API views. Thin: parse -> service -> shape."""
from __future__ import annotations

from django.db.models import Q
from django.utils.dateparse import parse_date
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from common.permissions import IsVerifiedStudent

from . import services
from .models import (
    Booking,
    BookingStatus,
    Ride,
    RideRequest,
    RideRequestStatus,
    RideStatus,
)
from .serializers import (
    BookingSerializer,
    RideCreateSerializer,
    RideDetailSerializer,
    RideListSerializer,
    RideRequestCreateSerializer,
    RideRequestSerializer,
)


class RideViewSet(
    mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet
):
    """Rides: create, view, search, history, and lifecycle transitions."""

    permission_classes = [IsVerifiedStudent]

    def get_queryset(self):
        base = Ride.objects.select_related("driver__profile", "vehicle")
        if self.action == "list":
            # The default list is "rides I'm offering as a driver".
            return base.filter(driver=self.request.user)
        return base

    def get_serializer_class(self):
        if self.action == "create":
            return RideCreateSerializer
        if self.action in {"list", "search"}:
            return RideListSerializer
        return RideDetailSerializer

    # ---- create ----
    def create(self, request):
        serializer = RideCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ride = services.create_ride(driver=request.user, **serializer.validated_data)
        return Response(
            RideDetailSerializer(ride, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    # ---- search ----
    @action(detail=False, methods=["get"])
    def search(self, request):
        p = request.query_params

        def _f(name):
            val = p.get(name)
            return float(val) if val not in (None, "") else None

        qs = services.search_rides(
            user=request.user,
            origin_lat=_f("origin_lat"),
            origin_lng=_f("origin_lng"),
            destination_lat=_f("destination_lat"),
            destination_lng=_f("destination_lng"),
            radius_m=int(p.get("radius_m") or 5000),
            date=parse_date(p["date"]) if p.get("date") else None,
            vehicle_type=p.get("vehicle_type") or None,
            min_seats=int(p.get("min_seats") or 1),
        )
        page = self.paginate_queryset(qs)
        serializer = RideListSerializer(
            page, many=True, context=self.get_serializer_context()
        )
        return self.get_paginated_response(serializer.data)

    # ---- history ----
    @action(detail=False, methods=["get"])
    def history(self, request):
        """Upcoming / active / completed / cancelled, across both roles (§34)."""
        user = request.user
        rides = (
            Ride.objects.select_related("driver__profile", "vehicle")
            .filter(
                Q(driver=user)
                | Q(bookings__passenger=user, bookings__status__in=[
                    BookingStatus.CONFIRMED, BookingStatus.COMPLETED, BookingStatus.CANCELLED
                ])
            )
            .distinct()
        )

        buckets: dict[str, list] = {
            "upcoming": [],
            "active": [],
            "completed": [],
            "cancelled": [],
        }
        for ride in rides:
            if ride.status in {RideStatus.OPEN, RideStatus.FULL}:
                buckets["upcoming"].append(ride)
            elif ride.status == RideStatus.STARTED:
                buckets["active"].append(ride)
            elif ride.status == RideStatus.COMPLETED:
                buckets["completed"].append(ride)
            elif ride.status == RideStatus.CANCELLED:
                buckets["cancelled"].append(ride)

        ctx = self.get_serializer_context()
        return Response(
            {k: RideListSerializer(v, many=True, context=ctx).data for k, v in buckets.items()}
        )

    # ---- lifecycle transitions ----
    def _transition(self, request, service_fn):
        ride = service_fn(ride_id=self.kwargs["pk"], driver=request.user)
        return Response(
            RideDetailSerializer(ride, context=self.get_serializer_context()).data
        )

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        return self._transition(request, services.start_ride)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        return self._transition(request, services.complete_ride)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        return self._transition(request, services.cancel_ride)

    @action(detail=True, methods=["post"])
    def request_join(self, request, pk=None):
        """Convenience alias: POST /api/rides/{id}/request_join/."""
        req = services.request_to_join(ride_id=pk, rider=request.user)
        return Response(
            RideRequestSerializer(req).data, status=status.HTTP_201_CREATED
        )


class RideRequestViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """Ride requests: create, list (incoming/outgoing), accept/reject/cancel."""

    permission_classes = [IsVerifiedStudent]
    serializer_class = RideRequestSerializer

    def get_queryset(self):
        user = self.request.user
        qs = RideRequest.objects.select_related("ride", "rider__profile")
        role = self.request.query_params.get("role")
        if role == "incoming":
            qs = qs.filter(ride__driver=user)  # requests for my rides
        elif role == "outgoing":
            qs = qs.filter(rider=user)  # requests I made
        else:
            qs = qs.filter(Q(rider=user) | Q(ride__driver=user))
        ride_id = self.request.query_params.get("ride")
        if ride_id:
            qs = qs.filter(ride_id=ride_id)
        return qs

    def create(self, request):
        serializer = RideRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        req = services.request_to_join(
            ride_id=serializer.validated_data["ride_id"], rider=request.user
        )
        return Response(RideRequestSerializer(req).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        booking = services.accept_request(request_id=pk, driver=request.user)
        return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        req = services.reject_request(request_id=pk, driver=request.user)
        return Response(RideRequestSerializer(req).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        req = services.cancel_request(request_id=pk, rider=request.user)
        return Response(RideRequestSerializer(req).data)


class BookingViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """The current student's bookings as a passenger."""

    permission_classes = [IsVerifiedStudent]
    serializer_class = BookingSerializer

    def get_queryset(self):
        return (
            Booking.objects.select_related("ride__driver__profile", "ride__vehicle")
            .filter(passenger=self.request.user)
        )

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        booking = services.cancel_booking(booking_id=pk, passenger=request.user)
        return Response(BookingSerializer(booking).data)
