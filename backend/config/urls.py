"""Root URL configuration."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


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
    # Domain routers are mounted here as their phases land:
    # path("api/chat/", include("chat.urls")),
    # ...
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
