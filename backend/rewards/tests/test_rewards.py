"""Points + ratings tests (§31, §32)."""
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import StudentProfile
from accounts.tests.factories import make_verified_user
from rewards.models import PointsTransaction, Rating
from rides.services import (
    accept_request,
    complete_ride,
    request_to_join,
    start_ride,
)
from rides.tests.factories import make_ride


def complete_ride_with_passenger(driver, passenger):
    ride = make_ride(driver, available_seats=2)
    req = request_to_join(ride_id=ride.id, rider=passenger)
    accept_request(request_id=req.id, driver=driver)
    start_ride(ride_id=ride.id, driver=driver)
    complete_ride(ride_id=ride.id, driver=driver)
    return ride


class PointsTests(APITestCase):
    def setUp(self):
        self.driver = make_verified_user(admission_number="ADM1", college_email="d@college.edu")
        self.passenger = make_verified_user(admission_number="ADM2", college_email="p@college.edu")

    def test_completion_awards_points_to_both(self):
        complete_ride_with_passenger(self.driver, self.passenger)

        self.assertEqual(StudentProfile.objects.get(user=self.driver).total_points, 15)
        self.assertEqual(StudentProfile.objects.get(user=self.passenger).total_points, 10)
        self.assertEqual(
            PointsTransaction.objects.filter(user=self.driver).first().points, 15
        )

    def test_points_award_is_idempotent(self):
        ride = complete_ride_with_passenger(self.driver, self.passenger)
        # Re-running the award must not double-credit (constraint-guarded).
        from rewards.services import award_points_for_ride

        award_points_for_ride(ride)
        self.assertEqual(StudentProfile.objects.get(user=self.driver).total_points, 15)
        self.assertEqual(
            PointsTransaction.objects.filter(user=self.driver, ride=ride).count(), 1
        )

    def test_points_summary_endpoint(self):
        complete_ride_with_passenger(self.driver, self.passenger)
        self.client.force_authenticate(self.driver)
        resp = self.client.get(reverse("rewards:points-summary"))
        self.assertEqual(resp.data["total_points"], 15)
        self.assertEqual(resp.data["completed_rides"], 1)

    def test_points_are_read_only(self):
        self.client.force_authenticate(self.driver)
        # No create route exists on the points endpoint.
        resp = self.client.post(reverse("rewards:points-list"), {"points": 9999})
        self.assertEqual(resp.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)


class RatingTests(APITestCase):
    def setUp(self):
        self.driver = make_verified_user(admission_number="ADM1", college_email="d@college.edu")
        self.passenger = make_verified_user(admission_number="ADM2", college_email="p@college.edu")
        self.ride = complete_ride_with_passenger(self.driver, self.passenger)
        self.url = reverse("ratings:rating-list")

    def _rate(self, reviewer, reviewee, score=5):
        self.client.force_authenticate(reviewer)
        return self.client.post(
            self.url,
            {"ride_id": str(self.ride.id), "reviewee_id": str(reviewee.id), "rating": score},
            format="json",
        )

    def test_participant_can_rate_and_average_updates(self):
        resp = self._rate(self.passenger, self.driver, 4)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            float(StudentProfile.objects.get(user=self.driver).average_rating), 4.0
        )

    def test_cannot_rate_self(self):
        resp = self._rate(self.driver, self.driver)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data["error"]["code"], "self_rating")

    def test_cannot_rate_twice(self):
        self._rate(self.passenger, self.driver, 5)
        resp = self._rate(self.passenger, self.driver, 3)
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(resp.data["error"]["code"], "already_rated")

    def test_cannot_rate_before_completion(self):
        open_ride = make_ride(self.driver, available_seats=2)
        req = request_to_join(ride_id=open_ride.id, rider=self.passenger)
        accept_request(request_id=req.id, driver=self.driver)
        self.client.force_authenticate(self.passenger)
        resp = self.client.post(
            self.url,
            {"ride_id": str(open_ride.id), "reviewee_id": str(self.driver.id), "rating": 5},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(resp.data["error"]["code"], "ride_not_completed")

    def test_non_participant_cannot_rate(self):
        outsider = make_verified_user(admission_number="ADM9", college_email="x@college.edu")
        resp = self._rate(outsider, self.driver)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_rateable_endpoint(self):
        self.client.force_authenticate(self.passenger)
        resp = self.client.get(reverse("ratings:rating-rateable"), {"ride": str(self.ride.id)})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        participants = resp.data["participants"]
        self.assertEqual(len(participants), 1)  # just the driver
        self.assertEqual(participants[0]["role"], "driver")
        self.assertFalse(participants[0]["already_rated"])
