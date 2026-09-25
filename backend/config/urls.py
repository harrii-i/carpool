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
    # Domain routers are mounted here as their phases land:
    # path("api/profile/", include("accounts.profile_urls")),
    # path("api/vehicles/", include("vehicles.urls")),
    # path("api/rides/", include("rides.urls")),
    # ...
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
