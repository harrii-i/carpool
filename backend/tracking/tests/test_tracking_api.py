"""Share-session + public tracking tests (§21–§23, §43)."""
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.tests.factories import make_verified_user
from rides.models import RideStatus
from rides.services import accept_request, request_to_join
from rides.tests.factories import make_ride
from tracking.models import RideShareSession


class ShareSessionTests(APITestCase):
    def setUp(self):
        self.driver = make_verified_user(admission_number="ADM1", college_email="d@college.edu")
        self.rider = make_verified_user(admission_number="ADM2", college_email="r@college.edu")
        self.outsider = make_verified_user(admission_number="ADM3", college_email="x@college.edu")
        self.ride = make_ride(self.driver, available_seats=2)
        req = request_to_join(ride_id=self.ride.id, rider=self.rider)
        accept_request(request_id=req.id, driver=self.driver)
        self.url = reverse("tracking:share-session-list")

    def test_participant_can_create_share_session(self):
        self.client.force_authenticate(self.rider)
        resp = self.client.post(self.url, {"ride_id": str(self.ride.id)}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resp.data["share_token"])
        self.assertIn(resp.data["share_token"], resp.data["share_url"])

    def test_outsider_cannot_create(self):
        self.client.force_authenticate(self.outsider)
        resp = self.client.post(self.url, {"ride_id": str(self.ride.id)}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_cannot_share_completed_ride(self):
        self.ride.status = RideStatus.CANCELLED
        self.ride.save(update_fields=["status"])
        self.client.force_authenticate(self.driver)
        resp = self.client.post(self.url, {"ride_id": str(self.ride.id)}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data["error"]["code"], "ride_not_live")

    def test_revoke_disables_session(self):
        self.client.force_authenticate(self.driver)
        created = self.client.post(self.url, {"ride_id": str(self.ride.id)}, format="json").data
        revoke_url = reverse("tracking:share-session-revoke", args=[created["id"]])
        resp = self.client.post(revoke_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data["is_active"])


class LocationAndPublicTrackTests(APITestCase):
    def setUp(self):
        self.driver = make_verified_user(admission_number="ADM1", college_email="d@college.edu")
        self.rider = make_verified_user(admission_number="ADM2", college_email="r@college.edu")
        self.ride = make_ride(self.driver, available_seats=2)
        req = request_to_join(ride_id=self.ride.id, rider=self.rider)
        accept_request(request_id=req.id, driver=self.driver)
        self.session = RideShareSession.objects.create(
            ride=self.ride,
            created_by=self.driver,
            expires_at=timezone.now() + timedelta(hours=1),
        )
        self.public_url = reverse("tracking:public-track", args=[self.session.share_token])

    def test_public_payload_has_no_private_data(self):
        resp = self.client.get(self.public_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        body = str(resp.data)
        self.assertNotIn(self.driver.email, body)
        self.assertNotIn("phone", body.lower())
        self.assertNotIn("admission", body.lower())
        self.assertIsNone(resp.data["current_location"])

    def test_driver_pushes_location_and_public_sees_it(self):
        self.client.force_authenticate(self.driver)
        loc_url = reverse("tracking:share-session-location", args=[self.session.id])
        resp = self.client.post(
            loc_url, {"latitude": 8.52, "longitude": 76.93, "speed": 30}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        # A public viewer (no auth) now sees the current location.
        self.client.force_authenticate(user=None)
        pub = self.client.get(self.public_url)
        self.assertIsNotNone(pub.data["current_location"])
        self.assertEqual(pub.data["current_location"]["latitude"], 8.52)

    def test_passenger_cannot_push_location(self):
        # A passenger may create their own share session, but still may not push
        # location updates — only the ride's driver can (§23).
        passenger_session = RideShareSession.objects.create(
            ride=self.ride,
            created_by=self.rider,
            expires_at=timezone.now() + timedelta(hours=1),
        )
        self.client.force_authenticate(self.rider)
        loc_url = reverse("tracking:share-session-location", args=[passenger_session.id])
        resp = self.client.post(loc_url, {"latitude": 8.52, "longitude": 76.93}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_invalid_token_404(self):
        resp = self.client.get(reverse("tracking:public-track", args=["nope"]))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_expired_token_rejected(self):
        self.session.expires_at = timezone.now() - timedelta(minutes=1)
        self.session.save(update_fields=["expires_at"])
        resp = self.client.get(self.public_url)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(resp.data["error"]["code"], "expired")

    def test_completing_ride_ends_sessions(self):
        from rides.services import complete_ride, start_ride

        start_ride(ride_id=self.ride.id, driver=self.driver)
        complete_ride(ride_id=self.ride.id, driver=self.driver)
        self.session.refresh_from_db()
        self.assertFalse(self.session.is_active)
        resp = self.client.get(self.public_url)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
