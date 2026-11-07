"""
ASGI entry point.

Serves HTTP through Django and WebSockets through Channels. The WebSocket
routing table is assembled in config.routing and grows as the chat and
tracking phases land.
"""
from django.core.asgi import get_asgi_application

from config._dotenv_settings import preload_settings_module

preload_settings_module(default="config.settings.dev")

# Initialise Django (populates the app registry) before importing anything
# that touches models / consumers.
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import AllowedHostsOriginValidator  # noqa: E402

from accounts.ws_auth import JWTAuthMiddleware  # noqa: E402
from config.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        # WebSockets authenticate with the same JWT access token as REST,
        # passed as ?token=<access>.
        "websocket": AllowedHostsOriginValidator(
            JWTAuthMiddleware(URLRouter(websocket_urlpatterns))
        ),
    }
)
