"""Reporting tests (§36)."""
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.tests.factories import make_verified_user
from reports.models import Report, ReportStatus


class ReportTests(APITestCase):
    def setUp(self):
        self.user = make_verified_user(admission_number="ADM1", college_email="u@college.edu")
        self.reported = make_verified_user(admission_number="ADM2", college_email="r@college.edu")
        self.client.force_authenticate(self.user)
        self.url = reverse("reports:report-list")

    def test_file_report(self):
        resp = self.client.post(
            self.url,
            {"reported_user": str(self.reported.id), "reason": "HARASSMENT", "description": "…"},
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["status"], ReportStatus.PENDING)
        self.assertEqual(Report.objects.get().reporter, self.user)

    def test_cannot_report_self(self):
        resp = self.client.post(
            self.url, {"reported_user": str(self.user.id), "reason": "OTHER"}
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_report_requires_user_or_ride(self):
        resp = self.client.post(self.url, {"reason": "OTHER", "description": "nothing"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_status_is_not_client_settable(self):
        resp = self.client.post(
            self.url,
            {"reported_user": str(self.reported.id), "reason": "OTHER", "status": "RESOLVED"},
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["status"], ReportStatus.PENDING)

    def test_list_scoped_to_reporter(self):
        self.client.post(self.url, {"reported_user": str(self.reported.id), "reason": "OTHER"})
        self.client.force_authenticate(self.reported)
        self.assertEqual(self.client.get(self.url).data["count"], 0)
