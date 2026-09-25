"""Tracking WebSocket tests (§23)."""
from datetime import timedelta

from asgiref.sync import async_to_sync
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework_simplejwt.tokens import AccessToken

from accounts.tests.factories import make_verified_user
from accounts.ws_auth import JWTAuthMiddleware
from rides.tests.factories import make_ride
from tracking.models import RideShareSession
from tracking.routing import websocket_urlpatterns

application = JWTAuthMiddleware(URLRouter(websocket_urlpatterns))


async def connect(token_path, jwt=None):
    url = f"/ws/tracking/{token_path}/"
    if jwt:
        url += f"?token={jwt}"
    comm = WebsocketCommunicator(application, url)
    connected, _ = await comm.connect()
    return comm, connected


class TrackingWebSocketTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.driver = make_verified_user(admission_number="ADM1", college_email="d@college.edu")
        self.ride = make_ride(self.driver, available_seats=2)
        self.session = RideShareSession.objects.create(
            ride=self.ride,
            created_by=self.driver,
            expires_at=timezone.now() + timedelta(hours=1),
        )

    def test_viewer_connects_and_driver_push_broadcasts(self):
        async def body():
            viewer, ok = await connect(self.session.share_token)  # public, no token
            self.assertTrue(ok)

            driver_jwt = str(AccessToken.for_user(self.driver))
            driver, ok_d = await connect(self.session.share_token, jwt=driver_jwt)
            self.assertTrue(ok_d)

            await driver.send_json_to(
                {"latitude": 8.5, "longitude": 76.9, "speed": 25, "heading": 90}
            )
            got = await viewer.receive_json_from(timeout=3)
            self.assertEqual(got["type"], "location")
            self.assertEqual(got["latitude"], 8.5)

            await viewer.disconnect()
            await driver.disconnect()

        async_to_sync(body)()

    def test_invalid_token_refused(self):
        async def body():
            comm, connected = await connect("not-a-real-token")
            self.assertFalse(connected)
            await comm.disconnect()

        async_to_sync(body)()

    def test_viewer_cannot_push_location(self):
        async def body():
            viewer, ok = await connect(self.session.share_token)
            self.assertTrue(ok)
            await viewer.send_json_to({"latitude": 1.0, "longitude": 2.0})
            got = await viewer.receive_json_from(timeout=3)
            self.assertEqual(got["type"], "error")
            self.assertEqual(got["code"], "forbidden")
            await viewer.disconnect()

        async_to_sync(body)()
