from rest_framework.routers import DefaultRouter

from .views import PointsViewSet, RatingViewSet

app_name = "rewards"

# Points live under /api/rewards/points/; ratings are mounted separately at
# /api/ratings/ by the project urlconf.
points_router = DefaultRouter()
points_router.register("points", PointsViewSet, basename="points")

ratings_router = DefaultRouter()
ratings_router.register("", RatingViewSet, basename="rating")

urlpatterns = points_router.urls
ratings_urlpatterns = ratings_router.urls
