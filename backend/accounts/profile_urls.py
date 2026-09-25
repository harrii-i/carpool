from django.urls import path

from .profile_views import ProfileView

app_name = "profile"

urlpatterns = [
    path("", ProfileView.as_view(), name="profile"),
]
