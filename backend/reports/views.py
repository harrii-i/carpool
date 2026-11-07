"""Reporting API (§36). Students file reports; admins review them in Django Admin."""
from rest_framework import mixins, viewsets

from common.permissions import IsVerifiedStudent

from .models import Report
from .serializers import ReportSerializer


class ReportViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """File a report and view your own reports. Status is admin-controlled."""

    permission_classes = [IsVerifiedStudent]
    serializer_class = ReportSerializer

    def get_queryset(self):
        return Report.objects.filter(reporter=self.request.user)

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "request": self.request}

    def perform_create(self, serializer):
        serializer.save(reporter=self.request.user)
