"""Vehicle CRUD + ownership tests (§10, §38)."""
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.tests.factories import make_verified_user
from vehicles.models import Vehicle


def auth(client, user):
    client.force_authenticate(user=user)


class VehicleTests(APITestCase):
    def setUp(self):
        self.user = make_verified_user(admission_number="ADM2002", college_email="a@college.edu")
        self.other = make_verified_user(admission_number="ADM3003", college_email="b@college.edu")
        self.list_url = reverse("vehicles:vehicle-list")
        self.payload = {
            "vehicle_type": "CAR",
            "brand": "Toyota",
            "model": "Etios",
            "registration_number": "kl01ab1234",
            "color": "White",
            "seat_capacity": 4,
        }

    def test_create_vehicle_normalizes_registration(self):
        auth(self.client, self.user)
        resp = self.client.post(self.list_url, self.payload)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["registration_number"], "KL01AB1234")
        self.assertEqual(Vehicle.objects.get().owner, self.user)

    def test_duplicate_registration_rejected(self):
        auth(self.client, self.user)
        self.client.post(self.list_url, self.payload)
        resp = self.client.post(self.list_url, {**self.payload, "brand": "Honda"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_is_scoped_to_owner(self):
        auth(self.client, self.user)
        self.client.post(self.list_url, self.payload)
        auth(self.client, self.other)
        resp = self.client.get(self.list_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 0)

    def test_cannot_modify_others_vehicle(self):
        auth(self.client, self.user)
        created = self.client.post(self.list_url, self.payload).data
        auth(self.client, self.other)
        detail = reverse("vehicles:vehicle-detail", args=[created["id"]])
        resp = self.client.patch(detail, {"color": "Black"})
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_deactivate_action(self):
        auth(self.client, self.user)
        created = self.client.post(self.list_url, self.payload).data
        url = reverse("vehicles:vehicle-deactivate", args=[created["id"]])
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data["is_active"])

    def test_unverified_user_forbidden(self):
        unverified = make_verified_user(admission_number="ADM4004", college_email="c@college.edu")
        unverified.is_verified = False
        unverified.save(update_fields=["is_verified"])
        auth(self.client, unverified)
        resp = self.client.get(self.list_url)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
