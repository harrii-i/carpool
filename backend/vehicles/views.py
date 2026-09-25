"""Vehicle CRUD, scoped to the authenticated owner."""
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from common.permissions import IsVerifiedStudent

from .models import Vehicle
from .serializers import VehicleSerializer


class VehicleViewSet(viewsets.ModelViewSet):
    """Manage the current student's vehicles.

    Every query is scoped to ``request.user`` so a student can only see and
    modify their own vehicles (§38). Registration numbers are validated unique.
    """

    serializer_class = VehicleSerializer
    permission_classes = [IsVerifiedStudent]

    def get_queryset(self):
        return Vehicle.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        """Soft-disable a vehicle without deleting its history (§10)."""
        vehicle = self.get_object()
        vehicle.is_active = False
        vehicle.save(update_fields=["is_active", "updated_at"])
        return Response(self.get_serializer(vehicle).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        vehicle = self.get_object()
        vehicle.is_active = True
        vehicle.save(update_fields=["is_active", "updated_at"])
        return Response(self.get_serializer(vehicle).data, status=status.HTTP_200_OK)
