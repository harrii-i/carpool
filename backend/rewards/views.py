"""Reputation API: points (read-only) and ratings (§31, §32)."""
from django.db.models import Q, Sum
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from common.exceptions import ValidationError
from common.permissions import IsVerifiedStudent
from rides.models import Ride

from . import services
from .models import PointsTransaction, Rating
from .serializers import (
    CreateRatingSerializer,
    PointsTransactionSerializer,
    RatingSerializer,
)


class PointsViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """The caller's points ledger. Points are never client-writable (§31)."""

    permission_classes = [IsVerifiedStudent]
    serializer_class = PointsTransactionSerializer

    def get_queryset(self):
        return PointsTransaction.objects.filter(user=self.request.user)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        from accounts.models import StudentProfile

        total = self.get_queryset().aggregate(total=Sum("points"))["total"] or 0
        # Read the profile fresh (mirrored counters are updated via bulk update,
        # which does not refresh any cached related object on request.user).
        profile = (
            StudentProfile.objects.filter(user=request.user)
            .values("completed_rides", "average_rating")
            .first()
            or {}
        )
        return Response(
            {
                "total_points": total,
                "completed_rides": profile.get("completed_rides", 0),
                "average_rating": profile.get("average_rating", 0),
            }
        )


class RatingViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    permission_classes = [IsVerifiedStudent]
    serializer_class = RatingSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Rating.objects.all()
        role = self.request.query_params.get("role")
        if role == "given":
            qs = qs.filter(reviewer=user)
        elif role == "received":
            qs = qs.filter(reviewee=user)
        else:
            qs = qs.filter(Q(reviewer=user) | Q(reviewee=user))
        ride_id = self.request.query_params.get("ride")
        if ride_id:
            qs = qs.filter(ride_id=ride_id)
        return qs

    def create(self, request):
        serializer = CreateRatingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rating = services.create_rating(reviewer=request.user, **serializer.validated_data)
        return Response(RatingSerializer(rating).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def rateable(self, request):
        """Who the caller can still rate for a given completed ride."""
        ride_id = request.query_params.get("ride")
        if not ride_id:
            raise ValidationError("A 'ride' query parameter is required.", code="ride_required")
        ride = Ride.objects.filter(pk=ride_id).first()
        if ride is None:
            raise ValidationError("Ride not found.", code="ride_not_found")
        return Response(
            {"participants": services.rateable_participants(ride=ride, reviewer=request.user)}
        )
