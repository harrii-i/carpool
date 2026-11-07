"""
Local development settings — no Docker, no Redis required.

Use this when you have PostgreSQL + PostGIS available locally (see
scripts/dev_db.sh) but haven't installed Redis. The cache and Channels layer
run in-process instead of via Redis, which is fine for a single local dev
server (one `daphne`/`runserver` process). It does mean:

  * Rate-limit counters reset whenever the server restarts.
  * This won't work across multiple server processes (fine for local dev).

For anything closer to production behaviour, install Redis
(`brew install redis && brew services start redis`) and use config.settings.dev
with REDIS_URL set instead.
"""
from .dev import *  # noqa: F401,F403

CACHES = {
    "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"},
}

CHANNEL_LAYERS = {
    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"},
}
