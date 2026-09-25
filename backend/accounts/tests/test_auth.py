"""Login / refresh / logout / me tests (§46 Authentication + Authorization)."""
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from accounts.services import register_student

from .factories import make_registry_student, make_verified_user


class LoginTests(APITestCase):
    def setUp(self):
        self.login_url = reverse("accounts:login")
        self.user = make_verified_user(college_email="verified@college.edu")

    def test_login_returns_token_pair(self):
        resp = self.client.post(
            self.login_url,
            {"email": "verified@college.edu", "password": "StrongPassw0rd!"},
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)

    def test_wrong_password_rejected(self):
        resp = self.client.post(
            self.login_url, {"email": "verified@college.edu", "password": "wrong"}
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unverified_user_cannot_login(self):
        make_registry_student(admission_number="ADM3003", college_email="new@college.edu")
        register_student(
            admission_number="ADM3003",
            college_email="new@college.edu",
            phone_number="+919000000001",
            password="StrongPassw0rd!",
        )
        resp = self.client.post(
            self.login_url, {"email": "new@college.edu", "password": "StrongPassw0rd!"}
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class TokenLifecycleTests(APITestCase):
    def setUp(self):
        self.user = make_verified_user(college_email="verified@college.edu")
        resp = self.client.post(
            reverse("accounts:login"),
            {"email": "verified@college.edu", "password": "StrongPassw0rd!"},
        )
        self.access = resp.data["access"]
        self.refresh = resp.data["refresh"]

    def test_refresh_returns_new_access(self):
        resp = self.client.post(reverse("accounts:refresh"), {"refresh": self.refresh})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access", resp.data)

    def test_logout_blacklists_refresh(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.access}")
        resp = self.client.post(reverse("accounts:logout"), {"refresh": self.refresh})
        self.assertEqual(resp.status_code, status.HTTP_205_RESET_CONTENT)

        # Blacklisted refresh can no longer mint access tokens.
        self.client.credentials()
        again = self.client.post(reverse("accounts:refresh"), {"refresh": self.refresh})
        self.assertEqual(again.status_code, status.HTTP_401_UNAUTHORIZED)


class MeEndpointTests(APITestCase):
    def setUp(self):
        self.user = make_verified_user(college_email="verified@college.edu")

    def test_me_requires_authentication(self):
        resp = self.client.get(reverse("accounts:me"))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_own_profile(self):
        login = self.client.post(
            reverse("accounts:login"),
            {"email": "verified@college.edu", "password": "StrongPassw0rd!"},
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        resp = self.client.get(reverse("accounts:me"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["email"], "verified@college.edu")
        self.assertEqual(resp.data["profile"]["admission_number"], "ADM2002")
        # Password / sensitive auth internals never surface here.
        self.assertNotIn("password", resp.data)
