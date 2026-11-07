"""Profile view tests (§9), including a regression test for profile_image
serializing to an absolute URL (the view must pass request context)."""
import base64

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .factories import make_verified_user

# A minimal valid 1x1 transparent PNG, for exercising the ImageField upload.
_PNG_1PX = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42Y"
    "AAAAASUVORK5CYII="
)


class ProfileViewTests(APITestCase):
    def setUp(self):
        self.user = make_verified_user(college_email="verified@college.edu")
        self.client.force_authenticate(self.user)
        self.url = reverse("profile:profile")

    def test_get_returns_profile(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["admission_number"], "ADM2002")

    def test_patch_updates_phone_number(self):
        resp = self.client.patch(self.url, {"phone_number": "+919999999999"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["phone_number"], "+919999999999")

    def test_patch_cannot_change_identity_fields(self):
        resp = self.client.patch(self.url, {"name": "Someone Else", "department": "Physics"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # Silently ignored — not part of the editable serializer's fields (§9).
        self.assertEqual(resp.data["name"], self.user.profile.name)
        self.assertEqual(resp.data["department"], self.user.profile.department)

    def test_profile_image_serializes_to_absolute_url(self):
        """Regression test: without request context, DRF returns a bare
        relative path (e.g. '/media/profiles/x.png') that the mobile app
        cannot load as an image — it must be absolute."""
        from django.core.files.uploadedfile import SimpleUploadedFile

        image = SimpleUploadedFile("avatar.png", _PNG_1PX, content_type="image/png")
        resp = self.client.patch(self.url, {"profile_image": image}, format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["profile_image"].startswith("http"))

        # /api/auth/me/ embeds the same serializer — must be absolute there too.
        me = self.client.get(reverse("accounts:me"))
        self.assertTrue(me.data["profile"]["profile_image"].startswith("http"))
