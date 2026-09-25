from rest_framework.routers import DefaultRouter

from .views import BookingViewSet, RideRequestViewSet, RideViewSet

app_name = "rides"

router = DefaultRouter()
router.register("rides", RideViewSet, basename="ride")
router.register("ride-requests", RideRequestViewSet, basename="ride-request")
router.register("bookings", BookingViewSet, basename="booking")

urlpatterns = router.urls
