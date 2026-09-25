"""WebSocket consumer that streams a user's live notifications."""
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .services import user_group


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """/ws/notifications/?token=<access> — joins the caller's own group."""

    async def connect(self):
        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close(code=4401)
            return
        self.group = user_group(user.id)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, "group"):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def notify(self, event):
        """Handler for group_send(type="notify")."""
        await self.send_json(event["payload"])
