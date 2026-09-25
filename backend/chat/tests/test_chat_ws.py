"""WebSocket chat consumer tests (§20, §38).

Uses a TransactionTestCase because the consumer reads the database from a
threadpool (database_sync_to_async), which only sees committed rows.
"""
from asgiref.sync import async_to_sync
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase
from rest_framework_simplejwt.tokens import AccessToken

from accounts.tests.factories import make_verified_user
from accounts.ws_auth import JWTAuthMiddleware
from chat.models import Conversation
from chat.routing import websocket_urlpatterns
from rides.services import accept_request, request_to_join
from rides.tests.factories import make_ride

# Application under test: JWT middleware + chat routes, no origin validator.
application = JWTAuthMiddleware(URLRouter(websocket_urlpatterns))


def token_for(user) -> str:
    return str(AccessToken.for_user(user))


async def connect(conversation_id, token=None):
    url = f"/ws/chat/{conversation_id}/"
    if token:
        url += f"?token={token}"
    communicator = WebsocketCommunicator(application, url)
    connected, _ = await communicator.connect()
    return communicator, connected


class ChatWebSocketTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.driver = make_verified_user(admission_number="ADM1", college_email="d@college.edu")
        self.rider = make_verified_user(admission_number="ADM2", college_email="r@college.edu")
        self.outsider = make_verified_user(admission_number="ADM3", college_email="x@college.edu")
        self.ride = make_ride(self.driver, available_seats=2)
        req = request_to_join(ride_id=self.ride.id, rider=self.rider)
        accept_request(request_id=req.id, driver=self.driver)
        self.conversation = Conversation.objects.get(ride=self.ride)

    def test_participant_can_connect_and_exchange_messages(self):
        async def body():
            drv, ok_d = await connect(self.conversation.id, token_for(self.driver))
            self.assertTrue(ok_d)
            rdr, ok_r = await connect(self.conversation.id, token_for(self.rider))
            self.assertTrue(ok_r)

            await rdr.send_json_to({"action": "message", "message": "Hello driver"})

            # Both sockets in the group receive the broadcast.
            got_driver = await drv.receive_json_from(timeout=3)
            self.assertEqual(got_driver["type"], "message")
            self.assertEqual(got_driver["message"], "Hello driver")
            self.assertEqual(str(got_driver["sender_id"]), str(self.rider.id))

            await drv.disconnect()
            await rdr.disconnect()

        async_to_sync(body)()

    def test_unauthenticated_connection_refused(self):
        async def body():
            comm, connected = await connect(self.conversation.id, token=None)
            self.assertFalse(connected)
            await comm.disconnect()

        async_to_sync(body)()

    def test_non_participant_connection_refused(self):
        async def body():
            comm, connected = await connect(
                self.conversation.id, token_for(self.outsider)
            )
            self.assertFalse(connected)
            await comm.disconnect()

        async_to_sync(body)()
