"""Development settings."""
from .base import *  # noqa: F401,F403
from .base import env

DEBUG = True

ALLOWED_HOSTS = env("ALLOWED_HOSTS", default=["*"])

# Permissive CORS in development so Expo (any LAN origin) can connect.
CORS_ALLOW_ALL_ORIGINS = True
