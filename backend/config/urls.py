"""Root URL configuration."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path

from rewards.urls import ratings_urlpatterns as rewards_ratings_urls
from rewards.urls import urlpatterns as rewards_points_urls


def health(_request):
    """Lightweight liveness probe."""
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("healthz/", health, name="health"),
    path("api/auth/", include("accounts.urls")),
    path("api/profile/", include("accounts.profile_urls")),
    path("api/vehicles/", include("vehicles.urls")),
    # rides.urls registers rides/, ride-requests/, and bookings/ under /api/.
    path("api/", include("rides.urls")),
    path("api/chat/", include("chat.urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/tracking/", include("tracking.urls")),
    path("api/sos/", include("safety.urls")),
    # rewards exposes two mount points: points ledger and ratings.
    path("api/rewards/", include((rewards_points_urls, "rewards"))),
    path("api/ratings/", include((rewards_ratings_urls, "ratings"))),
    path("api/reports/", include("reports.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
