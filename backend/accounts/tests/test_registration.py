"""Registration tests (§46 Authentication)."""
from django.core import mail
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import EmailVerification, StudentProfile, User

from .factories import make_registry_student


class RegistrationTests(APITestCase):
    def setUp(self):
        self.url = reverse("accounts:register")
        self.record = make_registry_student(
            admission_number="ADM1001", college_email="aisha@college.edu"
        )
        self.payload = {
            "admission_number": "ADM1001",
            "college_email": "aisha@college.edu",
            "phone_number": "+919812345678",
            "password": "StrongPassw0rd!",
        }

    def test_valid_registration_creates_inactive_user_and_sends_otp(self):
        resp = self.client.post(self.url, self.payload)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(email="aisha@college.edu")
        self.assertFalse(user.is_active)
        self.assertFalse(user.is_verified)

        profile = StudentProfile.objects.get(user=user)
        # Identity fields come from the registry, not client input.
        self.assertEqual(profile.name, self.record.name)
        self.assertEqual(profile.department, self.record.department)
        self.assertEqual(profile.year, self.record.year)

        self.assertEqual(EmailVerification.objects.filter(user=user).count(), 1)
        self.assertEqual(len(mail.outbox), 1)

    def test_identity_fields_ignored_from_client(self):
        # Even if a client smuggles extra fields, they are ignored.
        payload = {**self.payload, "name": "Impostor", "department": "Hacking", "year": 5}
        resp = self.client.post(self.url, payload)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        profile = StudentProfile.objects.get(user__email="aisha@college.edu")
        self.assertEqual(profile.name, "Aisha Rahman")
        self.assertEqual(profile.department, "Computer Science")

    def test_unknown_admission_number_rejected(self):
        payload = {**self.payload, "admission_number": "NOPE"}
        resp = self.client.post(self.url, payload)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(resp.data["error"]["code"], "admission_not_found")
        self.assertFalse(User.objects.exists())

    def test_inactive_registry_record_rejected(self):
        make_registry_student(
            admission_number="ADM9", college_email="x@college.edu", is_active=False
        )
        payload = {**self.payload, "admission_number": "ADM9", "college_email": "x@college.edu"}
        resp = self.client.post(self.url, payload)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data["error"]["code"], "admission_inactive")

    def test_email_must_match_registry(self):
        payload = {**self.payload, "college_email": "someone-else@college.edu"}
        resp = self.client.post(self.url, payload)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data["error"]["code"], "email_mismatch")

    def test_duplicate_admission_number_rejected(self):
        self.client.post(self.url, self.payload)
        resp = self.client.post(self.url, self.payload)
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(resp.data["error"]["code"], "already_registered")

    def test_weak_password_rejected(self):
        payload = {**self.payload, "password": "123"}
        resp = self.client.post(self.url, payload)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.exists())
