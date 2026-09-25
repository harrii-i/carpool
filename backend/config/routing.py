"""
Aggregated WebSocket URL routing.

Each real-time app contributes its own ``websocket_urlpatterns`` which are
combined here. Populated in later phases:

    /ws/chat/{conversation_id}/      (chat, Phase 3)
    /ws/tracking/{share_token}/      (tracking, Phase 4)
"""

websocket_urlpatterns: list = []

# Populated as apps land, e.g.:
# from chat.routing import websocket_urlpatterns as chat_ws
# from tracking.routing import websocket_urlpatterns as tracking_ws
# websocket_urlpatterns = chat_ws + tracking_ws
