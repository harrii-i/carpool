"""
Live-tracking consumer (§23): /ws/tracking/{share_token}/

Anyone with a valid token may connect and *view* (public link viewers need no
account). Only the ride's authenticated driver may push location updates. On
connect, the latest known location (if any) is sent immediately.
"""
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from common.exceptions import DomainError

from . import services


class TrackingConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.token = self.scope["url_route"]["kwargs"]["share_token"]
        try:
            session = await database_sync_to_async(services.get_live_session)(self.token)
        except DomainError:
            await self.close(code=4404)
            return

        self.ride_driver_id = session.ride.driver_id
        self.group = services.tracking_group(self.token)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

        # Send the current position immediately so viewers aren't left blank.
        current = await database_sync_to_async(services.get_current_location)(self.token)
        if current:
            await self.send_json({"type": "location", **current})

    async def disconnect(self, code):
        if hasattr(self, "group"):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive_json(self, content, **kwargs):
        # Only the authenticated driver may push updates.
        user = self.scope.get("user")
        if user is None or not user.is_authenticated or user.id != self.ride_driver_id:
            await self.send_json({"type": "error", "code": "forbidden"})
            return
        try:
            await database_sync_to_async(services.record_location)(
                token=self.token,
                latitude=content["latitude"],
                longitude=content["longitude"],
                speed=content.get("speed"),
                heading=content.get("heading"),
                timestamp=content.get("timestamp"),
            )
        except (KeyError, TypeError):
            await self.send_json({"type": "error", "code": "invalid_payload"})
        except DomainError as exc:
            await self.send_json(
                {"type": "error", "code": getattr(exc, "code", "error"), "message": str(exc)}
            )

    # ---- group handlers ----
    async def location_update(self, event):
        await self.send_json({"type": "location", **event["payload"]})

    async def tracking_ended(self, event):
        await self.send_json({"type": "ended", **event["payload"]})
        await self.close(code=4403)
