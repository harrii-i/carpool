"""Chat REST + access-control tests (§20, §38)."""
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.tests.factories import make_verified_user
from chat.models import Conversation, Message
from notifications.models import Notification, NotificationType
from rides.services import accept_request, request_to_join
from rides.tests.factories import make_ride


class ChatAccessTests(APITestCase):
    def setUp(self):
        self.driver = make_verified_user(admission_number="ADM1", college_email="d@college.edu")
        self.rider = make_verified_user(admission_number="ADM2", college_email="r@college.edu")
        self.outsider = make_verified_user(admission_number="ADM3", college_email="x@college.edu")
        self.ride = make_ride(self.driver, available_seats=2)

        # Confirm the rider -> conversation is created with driver + rider.
        req = request_to_join(ride_id=self.ride.id, rider=self.rider)
        accept_request(request_id=req.id, driver=self.driver)
        self.conversation = Conversation.objects.get(ride=self.ride)

    def test_conversation_created_with_both_participants(self):
        participant_ids = set(
            self.conversation.participants.values_list("user_id", flat=True)
        )
        self.assertEqual(participant_ids, {self.driver.id, self.rider.id})

    def test_list_only_shows_my_conversations(self):
        self.client.force_authenticate(self.outsider)
        resp = self.client.get(reverse("chat:conversation-list"))
        self.assertEqual(resp.data["count"], 0)

        self.client.force_authenticate(self.rider)
        resp = self.client.get(reverse("chat:conversation-list"))
        self.assertEqual(resp.data["count"], 1)

    def test_outsider_cannot_read_or_post_messages(self):
        self.client.force_authenticate(self.outsider)
        url = reverse("chat:conversation-messages", args=[self.conversation.id])
        self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(
            self.client.post(url, {"message": "hi"}).status_code, status.HTTP_404_NOT_FOUND
        )

    def test_send_message_persists_and_notifies_other(self):
        self.client.force_authenticate(self.rider)
        url = reverse("chat:conversation-messages", args=[self.conversation.id])
        resp = self.client.post(url, {"message": "On my way!"})
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resp.data["is_mine"])

        self.assertEqual(Message.objects.filter(conversation=self.conversation).count(), 1)
        # The driver (the other participant) gets a NEW_MESSAGE notification.
        self.assertTrue(
            Notification.objects.filter(
                user=self.driver, type=NotificationType.NEW_MESSAGE
            ).exists()
        )

    def test_empty_message_rejected(self):
        self.client.force_authenticate(self.rider)
        url = reverse("chat:conversation-messages", args=[self.conversation.id])
        resp = self.client.post(url, {"message": "   "})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_history_and_read_and_unread_count(self):
        url = reverse("chat:conversation-messages", args=[self.conversation.id])
        self.client.force_authenticate(self.driver)
        self.client.post(url, {"message": "Hi rider"})
        self.client.post(url, {"message": "See you at the gate"})

        # Rider sees two unread messages, then reads them.
        self.client.force_authenticate(self.rider)
        listing = self.client.get(reverse("chat:conversation-list"))
        self.assertEqual(listing.data["results"][0]["unread_count"], 2)

        history = self.client.get(url)
        self.assertEqual(history.data["count"], 2)

        read = self.client.post(reverse("chat:conversation-read", args=[self.conversation.id]))
        self.assertEqual(read.data["marked_read"], 2)

        listing = self.client.get(reverse("chat:conversation-list"))
        self.assertEqual(listing.data["results"][0]["unread_count"], 0)

    def test_chat_access_revoked_on_booking_cancel(self):
        from rides.models import Booking
        from rides.services import cancel_booking

        booking = Booking.objects.get(ride=self.ride, passenger=self.rider)
        cancel_booking(booking_id=booking.id, passenger=self.rider)

        self.client.force_authenticate(self.rider)
        url = reverse("chat:conversation-messages", args=[self.conversation.id])
        self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)
