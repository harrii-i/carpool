from django.urls import path

from .consumers import TrackingConsumer

websocket_urlpatterns = [
    path("ws/tracking/<str:share_token>/", TrackingConsumer.as_asgi()),
]
