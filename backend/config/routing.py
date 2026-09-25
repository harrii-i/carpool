"""
Aggregated WebSocket URL routing.

Each real-time app contributes its own ``websocket_urlpatterns`` which are
combined here:

    /ws/chat/{conversation_id}/      (chat)
    /ws/notifications/               (live notifications)
    /ws/tracking/{share_token}/      (tracking, Phase 4)
"""
from chat.routing import websocket_urlpatterns as chat_ws
from notifications.routing import websocket_urlpatterns as notifications_ws
from tracking.routing import websocket_urlpatterns as tracking_ws

websocket_urlpatterns = chat_ws + notifications_ws + tracking_ws
