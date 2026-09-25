"""
JWT authentication middleware for Channels.

The mobile app authenticates WebSockets with the same access token it uses for
REST, passed as a ``?token=`` query parameter:

    /ws/chat/<id>/?token=<access>

This mirrors DRF's JWTAuthentication for the WS transport and sets
``scope["user"]`` to the authenticated user (or AnonymousUser).
"""
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def _get_user(token: str):
    from rest_framework_simplejwt.exceptions import TokenError
    from rest_framework_simplejwt.tokens import AccessToken

    from accounts.models import User

    try:
        access = AccessToken(token)
        return User.objects.get(id=access["user_id"], is_active=True)
    except (TokenError, User.DoesNotExist, KeyError):
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get("query_string", b"").decode())
        token = query.get("token", [None])[0]
        scope["user"] = await _get_user(token) if token else AnonymousUser()
        return await super().__call__(scope, receive, send)
