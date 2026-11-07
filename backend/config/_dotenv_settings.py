"""
Shared helper: read DJANGO_SETTINGS_MODULE from .env before Django picks a
default settings module.

django-environ's env() calls inside settings/base.py only take effect *after*
a settings module is already chosen, which is too late to let .env override
DJANGO_SETTINGS_MODULE itself. manage.py, wsgi.py and asgi.py all need this
same one-line fix so a local .env (e.g. DJANGO_SETTINGS_MODULE=config.settings
.local for running without Docker/Redis) actually takes effect, whichever
entry point starts the process.
"""
import os
from pathlib import Path


def preload_settings_module(default: str = "config.settings.dev") -> None:
    if not os.environ.get("DJANGO_SETTINGS_MODULE"):
        env_path = Path(__file__).resolve().parent.parent.parent / ".env"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                line = line.strip()
                if line.startswith("DJANGO_SETTINGS_MODULE="):
                    os.environ["DJANGO_SETTINGS_MODULE"] = line.split("=", 1)[1].strip()
                    break
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", default)
