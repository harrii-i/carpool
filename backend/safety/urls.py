from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    EmergencyContactViewSet,
    SOSConfigView,
    SOSEventViewSet,
    SOSTriggerView,
)

app_name = "safety"

router = DefaultRouter()
router.register("contacts", EmergencyContactViewSet, basename="contact")
router.register("events", SOSEventViewSet, basename="sos-event")

urlpatterns = [
    path("config/", SOSConfigView.as_view(), name="config"),
    path("trigger/", SOSTriggerView.as_view(), name="trigger"),
    *router.urls,
]
