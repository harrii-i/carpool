"""
Test settings.

Runs against the same PostGIS database (geospatial features require it) but
with fast password hashing, an in-memory channel layer, and a locmem email
backend so tests can assert on sent messages.
"""
from .base import *  # noqa: F401,F403

DEBUG = False

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

# Predictable throttling in tests (disabled unless a test opts in).
REST_FRAMEWORK = {**REST_FRAMEWORK}  # noqa: F405
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {
    "auth_register": "1000/hour",
    "auth_login": "1000/min",
    "auth_verify": "1000/min",
    "auth_resend": "1000/hour",
}
