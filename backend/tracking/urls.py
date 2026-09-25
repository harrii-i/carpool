from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import PublicTrackView, ShareSessionViewSet

app_name = "tracking"

router = DefaultRouter()
router.register("sessions", ShareSessionViewSet, basename="share-session")

urlpatterns = [
    path("public/<str:token>/", PublicTrackView.as_view(), name="public-track"),
    *router.urls,
]
