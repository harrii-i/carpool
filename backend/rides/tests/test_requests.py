"""Ride request, booking, and seat-accounting tests (§16, §17, §18)."""
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.tests.factories import make_verified_user
from rides.models import (
    Booking,
    BookingStatus,
    Ride,
    RideRequest,
    RideRequestStatus,
    RideStatus,
)
from rides.services import accept_request, request_to_join
from rides.tests.factories import make_ride, make_vehicle


class RideRequestRuleTests(APITestCase):
    def setUp(self):
        self.driver = make_verified_user(admission_number="ADM1", college_email="d@college.edu")
        self.rider = make_verified_user(admission_number="ADM2", college_email="r@college.edu")
        self.ride = make_ride(self.driver, available_seats=1)
        self.create_url = reverse("rides:ride-request-list")

    def _request_as(self, user, ride_id=None):
        self.client.force_authenticate(user)
        return self.client.post(
            self.create_url, {"ride_id": str(ride_id or self.ride.id)}, format="json"
        )

    def test_request_to_join_ok(self):
        resp = self._request_as(self.rider)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["status"], RideRequestStatus.PENDING)

    def test_cannot_request_own_ride(self):
        resp = self._request_as(self.driver)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data["error"]["code"], "own_ride")

    def test_duplicate_pending_request_rejected(self):
        self._request_as(self.rider)
        resp = self._request_as(self.rider)
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(resp.data["error"]["code"], "duplicate_request")

    def test_request_full_ride_rejected(self):
        self.ride.status = RideStatus.FULL
        self.ride.available_seats = 0
        self.ride.save(update_fields=["status", "available_seats"])
        resp = self._request_as(self.rider)
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(resp.data["error"]["code"], "no_seats_available")

    def test_request_cancelled_ride_rejected(self):
        self.ride.status = RideStatus.CANCELLED
        self.ride.save(update_fields=["status"])
        resp = self._request_as(self.rider)
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(resp.data["error"]["code"], "ride_cancelled")


class AcceptRejectTests(APITestCase):
    def setUp(self):
        self.driver = make_verified_user(admission_number="ADM1", college_email="d@college.edu")
        self.rider = make_verified_user(admission_number="ADM2", college_email="r@college.edu")
        self.rider2 = make_verified_user(admission_number="ADM3", college_email="r2@college.edu")
        self.ride = make_ride(self.driver, available_seats=1)

    def test_accept_creates_booking_decrements_seats_and_marks_full(self):
        req = request_to_join(ride_id=self.ride.id, rider=self.rider)
        self.client.force_authenticate(self.driver)
        resp = self.client.post(reverse("rides:ride-request-accept", args=[req.id]))
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        self.ride.refresh_from_db()
        self.assertEqual(self.ride.available_seats, 0)
        self.assertEqual(self.ride.status, RideStatus.FULL)
        self.assertTrue(
            Booking.objects.filter(
                ride=self.ride, passenger=self.rider, status=BookingStatus.CONFIRMED
            ).exists()
        )

    def test_non_driver_cannot_accept(self):
        req = request_to_join(ride_id=self.ride.id, rider=self.rider)
        self.client.force_authenticate(self.rider2)
        resp = self.client.post(reverse("rides:ride-request-accept", args=[req.id]))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_last_seat_race_second_accept_fails(self):
        """Sequential stand-in for the concurrent last-seat case (§16, §39).

        Two riders both have pending requests for a one-seat ride. The first
        accept fills it; the second must fail rather than oversell.
        """
        r1 = request_to_join(ride_id=self.ride.id, rider=self.rider)
        r2 = request_to_join(ride_id=self.ride.id, rider=self.rider2)

        accept_request(request_id=r1.id, driver=self.driver)  # fills the seat

        self.client.force_authenticate(self.driver)
        resp = self.client.post(reverse("rides:ride-request-accept", args=[r2.id]))
        # Ride is no longer OPEN, so the second accept is rejected.
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)
        self.ride.refresh_from_db()
        self.assertEqual(self.ride.available_seats, 0)

    def test_reject_request(self):
        req = request_to_join(ride_id=self.ride.id, rider=self.rider)
        self.client.force_authenticate(self.driver)
        resp = self.client.post(reverse("rides:ride-request-reject", args=[req.id]))
        self.assertEqual(resp.data["status"], RideRequestStatus.REJECTED)
        self.assertFalse(Booking.objects.exists())

    def test_rider_cancels_own_request(self):
        req = request_to_join(ride_id=self.ride.id, rider=self.rider)
        self.client.force_authenticate(self.rider)
        resp = self.client.post(reverse("rides:ride-request-cancel", args=[req.id]))
        self.assertEqual(resp.data["status"], RideRequestStatus.CANCELLED)


class BookingCancellationTests(APITestCase):
    def setUp(self):
        self.driver = make_verified_user(admission_number="ADM1", college_email="d@college.edu")
        self.rider = make_verified_user(admission_number="ADM2", college_email="r@college.edu")
        self.ride = make_ride(self.driver, available_seats=1)
        req = request_to_join(ride_id=self.ride.id, rider=self.rider)
        self.booking = accept_request(request_id=req.id, driver=self.driver)

    def test_cancel_booking_restores_seat_and_reopens_ride(self):
        self.ride.refresh_from_db()
        self.assertEqual(self.ride.status, RideStatus.FULL)

        self.client.force_authenticate(self.rider)
        resp = self.client.post(reverse("rides:booking-cancel", args=[self.booking.id]))
        self.assertEqual(resp.data["status"], BookingStatus.CANCELLED)

        self.ride.refresh_from_db()
        self.assertEqual(self.ride.available_seats, 1)
        self.assertEqual(self.ride.status, RideStatus.OPEN)

    def test_cannot_cancel_someone_elses_booking(self):
        other = make_verified_user(admission_number="ADM9", college_email="x@college.edu")
        self.client.force_authenticate(other)
        resp = self.client.post(reverse("rides:booking-cancel", args=[self.booking.id]))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_bookings_list_scoped_to_passenger(self):
        self.client.force_authenticate(self.rider)
        resp = self.client.get(reverse("rides:booking-list"))
        self.assertEqual(resp.data["count"], 1)
