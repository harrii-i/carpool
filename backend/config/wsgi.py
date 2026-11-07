"""WSGI entry point (sync HTTP only; ASGI is preferred for this project)."""
from django.core.wsgi import get_wsgi_application

from config._dotenv_settings import preload_settings_module

preload_settings_module(default="config.settings.dev")

application = get_wsgi_application()
