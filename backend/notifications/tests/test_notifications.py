"""Notification feed + lifecycle-event wiring tests (§33)."""
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.tests.factories import make_verified_user
from notifications.models import Notification, NotificationType
from notifications.services import notify
from rides.services import accept_request, request_to_join
from rides.tests.factories import make_ride


class NotificationFeedTests(APITestCase):
    def setUp(self):
        self.user = make_verified_user(admission_number="ADM1", college_email="u@college.edu")
        self.client.force_authenticate(self.user)

    def test_list_scoped_and_unread_count(self):
        notify(self.user, NotificationType.RIDE_COMPLETED, "Done", "Ride complete")
        notify(self.user, NotificationType.POINTS_AWARDED, "Points", "You earned points")
        other = make_verified_user(admission_number="ADM2", college_email="o@college.edu")
        notify(other, NotificationType.RIDE_COMPLETED, "Done", "not mine")

        resp = self.client.get(reverse("notifications:notification-list"))
        self.assertEqual(resp.data["count"], 2)

        unread = self.client.get(reverse("notifications:notification-unread-count"))
        self.assertEqual(unread.data["unread_count"], 2)

    def test_mark_one_and_all_read(self):
        n1 = notify(self.user, NotificationType.RIDE_COMPLETED, "a")
        notify(self.user, NotificationType.RIDE_COMPLETED, "b")

        self.client.post(reverse("notifications:notification-read", args=[n1.id]))
        n1.refresh_from_db()
        self.assertTrue(n1.is_read)

        resp = self.client.post(reverse("notifications:notification-read-all"))
        self.assertEqual(resp.data["marked_read"], 1)  # only the still-unread one
        self.assertEqual(
            Notification.objects.filter(user=self.user, is_read=False).count(), 0
        )


class LifecycleNotificationTests(APITestCase):
    """Ride events must produce notifications for the right users (§33)."""

    def setUp(self):
        self.driver = make_verified_user(admission_number="ADM1", college_email="d@college.edu")
        self.rider = make_verified_user(admission_number="ADM2", college_email="r@college.edu")
        self.ride = make_ride(self.driver, available_seats=1)

    def test_request_notifies_driver(self):
        request_to_join(ride_id=self.ride.id, rider=self.rider)
        self.assertTrue(
            Notification.objects.filter(
                user=self.driver, type=NotificationType.RIDE_REQUEST_RECEIVED
            ).exists()
        )

    def test_accept_notifies_rider(self):
        req = request_to_join(ride_id=self.ride.id, rider=self.rider)
        accept_request(request_id=req.id, driver=self.driver)
        self.assertTrue(
            Notification.objects.filter(
                user=self.rider, type=NotificationType.RIDE_REQUEST_ACCEPTED
            ).exists()
        )
