from rest_framework.routers import DefaultRouter

from .views import ReportViewSet

app_name = "reports"

router = DefaultRouter()
router.register("", ReportViewSet, basename="report")

urlpatterns = router.urls
