"""Email verification tests (§46 Authentication)."""
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import EmailVerification, User
from accounts.services import register_student

from .factories import make_registry_student


class VerificationTests(APITestCase):
    def setUp(self):
        self.url = reverse("accounts:verify")
        make_registry_student(admission_number="ADM1001", college_email="aisha@college.edu")
        register_student(
            admission_number="ADM1001",
            college_email="aisha@college.edu",
            phone_number="+919812345678",
            password="StrongPassw0rd!",
        )
        self.user = User.objects.get(email="aisha@college.edu")
        self.code = EmailVerification.objects.get(user=self.user).code

    def test_valid_otp_activates_account_and_returns_tokens(self):
        resp = self.client.post(self.url, {"email": "aisha@college.edu", "code": self.code})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)

        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)
        self.assertTrue(self.user.is_verified)

    def test_invalid_otp_rejected_and_increments_attempts(self):
        resp = self.client.post(self.url, {"email": "aisha@college.edu", "code": "000000"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data["error"]["code"], "invalid_code")
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_verified)
        self.assertEqual(EmailVerification.objects.get(user=self.user).attempts, 1)

    def test_expired_otp_rejected(self):
        from django.utils import timezone
        from datetime import timedelta

        v = EmailVerification.objects.get(user=self.user)
        v.expires_at = timezone.now() - timedelta(minutes=1)
        v.save(update_fields=["expires_at"])

        resp = self.client.post(self.url, {"email": "aisha@college.edu", "code": self.code})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data["error"]["code"], "code_expired")

    def test_reused_code_rejected(self):
        self.client.post(self.url, {"email": "aisha@college.edu", "code": self.code})
        resp = self.client.post(self.url, {"email": "aisha@college.edu", "code": self.code})
        # Second attempt: account already verified.
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(resp.data["error"]["code"], "already_verified")

    def test_resend_issues_new_code_and_invalidates_old(self):
        old = EmailVerification.objects.get(user=self.user)
        resp = self.client.post(reverse("accounts:resend"), {"email": "aisha@college.edu"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        old.refresh_from_db()
        self.assertTrue(old.is_used)
        self.assertEqual(
            EmailVerification.objects.filter(user=self.user, is_used=False).count(), 1
        )
