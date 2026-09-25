"""Real-time chat consumer (§20): /ws/chat/{conversation_id}/?token=<access>."""
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from . import services


class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close(code=4401)
            return

        self.conversation_id = self.scope["url_route"]["kwargs"]["conversation_id"]
        allowed = await database_sync_to_async(services.is_participant)(
            self.conversation_id, user.id
        )
        if not allowed:
            # Not a confirmed participant -> refuse (§38).
            await self.close(code=4403)
            return

        self.group = services.conversation_group(self.conversation_id)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, "group"):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive_json(self, content, **kwargs):
        action = content.get("action", "message")
        user = self.scope["user"]

        if action == "message":
            text = content.get("message", "")
            try:
                await database_sync_to_async(self._create_message)(user, text)
            except Exception as exc:  # surface a structured error to just this socket
                await self.send_json(
                    {"type": "error", "code": getattr(exc, "code", "error"), "message": str(exc)}
                )
        elif action == "read":
            await database_sync_to_async(services.mark_read)(
                conversation_id=self.conversation_id, user=user
            )

    def _create_message(self, user, text):
        # Runs in a thread; broadcasting to the group is handled by the service.
        return services.create_message(
            conversation_id=self.conversation_id, sender=user, text=text
        )

    async def chat_message(self, event):
        """Handler for group_send(type="chat_message")."""
        await self.send_json({"type": "message", **event["payload"]})
