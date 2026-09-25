"""
Base settings shared across all environments.

Environment-specific settings live in dev.py / prod.py / test.py and import
from here. Values are read from the environment (see .env.example) so that no
secrets are hard-coded.
"""
from datetime import timedelta
from pathlib import Path

import environ

# backend/config/settings/base.py -> backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    CORS_ALLOWED_ORIGINS=(list, []),
    JWT_ACCESS_TOKEN_LIFETIME_MIN=(int, 15),
    JWT_REFRESH_TOKEN_LIFETIME_DAYS=(int, 7),
    OTP_LENGTH=(int, 6),
    OTP_TTL_MINUTES=(int, 10),
    OTP_MAX_ATTEMPTS=(int, 5),
    EMAIL_PORT=(int, 587),
    EMAIL_USE_TLS=(bool, True),
    EMAIL_HOST=(str, ""),
    TRACKING_UPDATE_INTERVAL_SECONDS=(int, 4),
    SHARE_SESSION_TTL_HOURS=(int, 6),
    POINTS_DRIVER_COMPLETE=(int, 15),
    POINTS_PASSENGER_COMPLETE=(int, 10),
    COLLEGE_DOMAIN=(str, "college.edu"),
    SENTRY_DSN=(str, ""),
)

# Read .env from the repo root (one level above backend/) when present.
environ.Env.read_env(BASE_DIR.parent / ".env")

# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------
SECRET_KEY = env("DJANGO_SECRET_KEY", default="insecure-dev-key-change-me")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env("ALLOWED_HOSTS")

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------
DJANGO_APPS = [
    "daphne",  # must precede django.contrib.staticfiles for the ASGI runserver
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.gis",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "channels",
]

LOCAL_APPS = [
    "common",
    "accounts",
    "vehicles",
    "rides",
    # Domain apps are added as their phases land:
    # "chat", "tracking", "safety", "rewards", "notifications", "reports",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ---------------------------------------------------------------------------
# Database (PostGIS)
# ---------------------------------------------------------------------------
DATABASES = {
    "default": env.db(
        "DATABASE_URL",
        default="postgis://carpool:carpool@localhost:5432/carpool",
    ),
}
# django-environ maps the postgis:// scheme to the GIS backend automatically,
# but we assert it here so a plain postgres:// URL still gets spatial support.
DATABASES["default"]["ENGINE"] = "django.contrib.gis.db.backends.postgis"

# GeoDjango locates GEOS/GDAL on the default library path in Docker/production.
# On hosts where they live elsewhere (e.g. Homebrew), point to them explicitly
# via the environment; unset (the default) leaves GeoDjango's own discovery.
_geos_lib = env("GEOS_LIBRARY_PATH", default="")
_gdal_lib = env("GDAL_LIBRARY_PATH", default="")
if _geos_lib:
    GEOS_LIBRARY_PATH = _geos_lib
if _gdal_lib:
    GDAL_LIBRARY_PATH = _gdal_lib

# ---------------------------------------------------------------------------
# Redis: cache + channel layer + live-location state
# ---------------------------------------------------------------------------
REDIS_URL = env("REDIS_URL", default="redis://localhost:6379/0")

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
    },
}

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    },
}

# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------------------
# DRF + SimpleJWT
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "common.pagination.DefaultPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        # Auth endpoints are rate-limited to blunt brute-force / abuse (§43).
        "auth_register": "10/hour",
        "auth_login": "10/min",
        "auth_verify": "10/min",
        "auth_resend": "5/hour",
    },
    "EXCEPTION_HANDLER": "common.exceptions.api_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env("JWT_ACCESS_TOKEN_LIFETIME_MIN")),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env("JWT_REFRESH_TOKEN_LIFETIME_DAYS")),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")

# ---------------------------------------------------------------------------
# Email (OTP delivery)
# ---------------------------------------------------------------------------
EMAIL_HOST = env("EMAIL_HOST")
if EMAIL_HOST:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_PORT = env("EMAIL_PORT")
    EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
    EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
    EMAIL_USE_TLS = env("EMAIL_USE_TLS")
else:
    # No SMTP configured -> print emails (and OTPs) to the console.
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = env(
    "DEFAULT_FROM_EMAIL", default="College Carpool <no-reply@college.edu>"
)

# ---------------------------------------------------------------------------
# Internationalisation
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static / media
# ---------------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Domain configuration (read by service layers)
# ---------------------------------------------------------------------------
COLLEGE_DOMAIN = env("COLLEGE_DOMAIN")

OTP_LENGTH = env("OTP_LENGTH")
OTP_TTL_MINUTES = env("OTP_TTL_MINUTES")
OTP_MAX_ATTEMPTS = env("OTP_MAX_ATTEMPTS")

TRACKING_UPDATE_INTERVAL_SECONDS = env("TRACKING_UPDATE_INTERVAL_SECONDS")
SHARE_SESSION_TTL_HOURS = env("SHARE_SESSION_TTL_HOURS")

POINTS_DRIVER_COMPLETE = env("POINTS_DRIVER_COMPLETE")
POINTS_PASSENGER_COMPLETE = env("POINTS_PASSENGER_COMPLETE")

# ---------------------------------------------------------------------------
# Logging — never log passwords or JWTs (§43).
# ---------------------------------------------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {"format": "{levelname} {asctime} {name} {message}", "style": "{"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "verbose"},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
}
