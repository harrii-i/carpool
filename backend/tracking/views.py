"""Tracking REST API (§21–§23)."""
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from common.exceptions import PermissionDeniedError
from common.permissions import IsVerifiedStudent

from . import services
from .models import RideShareSession
from .serializers import (
    CreateShareSessionSerializer,
    LocationUpdateSerializer,
    ShareSessionSerializer,
)


class ShareSessionViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """Create / list / revoke a participant's own share sessions."""

    permission_classes = [IsVerifiedStudent]
    serializer_class = ShareSessionSerializer

    def get_queryset(self):
        return RideShareSession.objects.filter(created_by=self.request.user)

    def create(self, request):
        serializer = CreateShareSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = services.create_share_session(
            ride_id=serializer.validated_data["ride_id"], user=request.user
        )
        return Response(
            ShareSessionSerializer(session).data, status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        session = services.revoke_share_session(session_id=pk, user=request.user)
        return Response(ShareSessionSerializer(session).data)

    @action(detail=True, methods=["post"])
    def location(self, request, pk=None):
        """Driver-only REST fallback for pushing a location update."""
        session = self.get_object()
        if session.ride.driver_id != request.user.id:
            raise PermissionDeniedError("Only the driver can send location updates.")
        serializer = LocationUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = services.record_location(
            token=session.share_token, **serializer.validated_data
        )
        return Response(payload)


class PublicTrackView(APIView):
    """Public tracking payload for a share token — no account required (§22).

    Exposes only non-sensitive ride data; never emergency contacts or private
    student identifiers (§43).
    """

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def get(self, request, token):
        return Response(services.public_track_payload(token))
