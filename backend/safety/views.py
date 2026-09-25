"""Safety API: emergency contacts, SOS config, SOS trigger + events (§25–§28)."""
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsVerifiedStudent

from . import services
from .models import EmergencyContact, SOSEvent
from .serializers import (
    EmergencyContactSerializer,
    SOSConfigSerializer,
    SOSEventSerializer,
    TriggerSOSSerializer,
)


class EmergencyContactViewSet(viewsets.ModelViewSet):
    """CRUD for the current student's emergency contacts (owner-only, §38)."""

    permission_classes = [IsVerifiedStudent]
    serializer_class = EmergencyContactSerializer

    def get_queryset(self):
        return EmergencyContact.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # Demote any existing primary first so the partial-unique constraint is
        # never briefly violated during the insert.
        if serializer.validated_data.get("is_primary"):
            services.clear_primary(user=self.request.user)
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        if serializer.validated_data.get("is_primary"):
            services.clear_primary(user=self.request.user, exclude_pk=serializer.instance.pk)
        serializer.save()

    @action(detail=True, methods=["post"])
    def set_primary(self, request, pk=None):
        contact = services.set_primary_contact(contact=self.get_object())
        return Response(self.get_serializer(contact).data)


class SOSConfigView(APIView):
    """GET / update the caller's SOS configuration (§26)."""

    permission_classes = [IsVerifiedStudent]

    def get(self, request):
        config = services.get_or_create_config(request.user)
        return Response(SOSConfigSerializer(config).data)

    def put(self, request):
        return self._update(request, partial=False)

    def patch(self, request):
        return self._update(request, partial=True)

    def _update(self, request, partial):
        config = services.get_or_create_config(request.user)
        serializer = SOSConfigSerializer(config, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class SOSTriggerView(APIView):
    """Trigger SOS: create the event and return the actions to run natively (§28)."""

    permission_classes = [IsVerifiedStudent]

    def post(self, request):
        serializer = TriggerSOSSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        event, actions = services.trigger_sos(user=request.user, **serializer.validated_data)
        return Response(
            {"event": SOSEventSerializer(event).data, "actions": actions},
            status=status.HTTP_201_CREATED,
        )


class SOSEventViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """The caller's own SOS event history (immutable; admin reviews the rest)."""

    permission_classes = [IsVerifiedStudent]
    serializer_class = SOSEventSerializer

    def get_queryset(self):
        return SOSEvent.objects.filter(user=self.request.user)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        from .models import SOSStatus

        event = services.update_sos_status(event=self.get_object(), status=SOSStatus.RESOLVED)
        return Response(self.get_serializer(event).data)
