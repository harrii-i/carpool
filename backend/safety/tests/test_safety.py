"""Emergency contacts, SOS config, and SOS trigger tests (§25–§30)."""
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.tests.factories import make_verified_user
from rides.services import accept_request, request_to_join, start_ride
from rides.tests.factories import make_ride
from safety.models import EmergencyContact, SOSEvent, SOSStatus
from tracking.models import RideShareSession


class EmergencyContactTests(APITestCase):
    def setUp(self):
        self.user = make_verified_user(admission_number="ADM1", college_email="u@college.edu")
        self.client.force_authenticate(self.user)
        self.url = reverse("safety:contact-list")

    def test_crud_and_owner_scoping(self):
        resp = self.client.post(
            self.url,
            {"name": "Mom", "phone_number": "+919812345678", "relationship": "Parent", "is_primary": True},
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        other = make_verified_user(admission_number="ADM2", college_email="o@college.edu")
        self.client.force_authenticate(other)
        self.assertEqual(self.client.get(self.url).data["count"], 0)

    def test_only_one_primary(self):
        c1 = self.client.post(
            self.url, {"name": "Mom", "phone_number": "+91981", "is_primary": True}
        ).data
        c2 = self.client.post(
            self.url, {"name": "Dad", "phone_number": "+91982", "is_primary": True}
        ).data
        # Setting a second primary demotes the first.
        primaries = EmergencyContact.objects.filter(user=self.user, is_primary=True)
        self.assertEqual(primaries.count(), 1)
        self.assertEqual(str(primaries.first().id), c2["id"])

    def test_set_primary_action(self):
        c1 = self.client.post(self.url, {"name": "Mom", "phone_number": "+91981"}).data
        c2 = self.client.post(self.url, {"name": "Dad", "phone_number": "+91982"}).data
        resp = self.client.post(reverse("safety:contact-set-primary", args=[c2["id"]]))
        self.assertTrue(resp.data["is_primary"])
        self.assertEqual(
            EmergencyContact.objects.filter(user=self.user, is_primary=True).count(), 1
        )


class SOSConfigTests(APITestCase):
    def setUp(self):
        self.user = make_verified_user(admission_number="ADM1", college_email="u@college.edu")
        self.client.force_authenticate(self.user)
        self.url = reverse("safety:config")

    def test_get_creates_default_config(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["call_primary_contact"])

    def test_update_config(self):
        resp = self.client.patch(
            self.url, {"notify_college_security": True, "custom_message": "Help {name}"}
        )
        self.assertTrue(resp.data["notify_college_security"])
        self.assertEqual(resp.data["custom_message"], "Help {name}")


class SOSTriggerTests(APITestCase):
    def setUp(self):
        self.driver = make_verified_user(admission_number="ADM1", college_email="d@college.edu", name="Aisha")
        self.passenger = make_verified_user(admission_number="ADM2", college_email="p@college.edu", name="Rahul")
        self.ride = make_ride(self.driver, available_seats=2)
        req = request_to_join(ride_id=self.ride.id, rider=self.passenger)
        accept_request(request_id=req.id, driver=self.driver)
        start_ride(ride_id=self.ride.id, driver=self.driver)

    def test_trigger_creates_event_and_actions_with_tracking_link(self):
        self.client.force_authenticate(self.passenger)
        # Give the passenger a primary contact so the call action is populated.
        EmergencyContact.objects.create(
            user=self.passenger, name="Mom", phone_number="+919812345678", is_primary=True
        )
        resp = self.client.post(
            reverse("safety:trigger"),
            {"latitude": 8.52, "longitude": 76.93},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        event = resp.data["event"]
        self.assertEqual(event["status"], SOSStatus.TRIGGERED)
        self.assertEqual(event["latitude"], 8.52)
        # An active ride was detected and captured in context.
        self.assertIn("ride", event["context"])

        actions = resp.data["actions"]
        self.assertEqual(actions["call"]["phone_number"], "+919812345678")
        self.assertTrue(actions["tracking_link"])
        self.assertTrue(actions["message"])

        # share_live_location default True + started ride => a share session exists.
        self.assertTrue(RideShareSession.objects.filter(ride=self.ride).exists())

    def test_event_is_persisted_and_scoped(self):
        self.client.force_authenticate(self.passenger)
        self.client.post(reverse("safety:trigger"), {"latitude": 1, "longitude": 2}, format="json")
        self.assertEqual(SOSEvent.objects.filter(user=self.passenger).count(), 1)

        # Another user cannot see it.
        self.client.force_authenticate(self.driver)
        resp = self.client.get(reverse("safety:sos-event-list"))
        self.assertEqual(resp.data["count"], 0)

    def test_message_variable_substitution(self):
        from safety.services import render_emergency_message

        msg = render_emergency_message(
            template="I am {name} on {ride}. Track: {location_link}",
            user=self.passenger,
            ride=self.ride,
            tracking_link="https://x/track/abc",
        )
        self.assertIn("Rahul", msg)
        self.assertIn("https://x/track/abc", msg)
