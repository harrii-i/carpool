"""Ride creation, search, details, lifecycle tests (§12, §13, §19)."""
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import StudentProfile
from accounts.tests.factories import make_verified_user
from rides.models import Ride, RideStatus
from rides.tests.factories import FAR, NEAR_A, NEAR_B, make_ride, make_vehicle


class RideCreateTests(APITestCase):
    def setUp(self):
        self.driver = make_verified_user(admission_number="ADM1", college_email="d@college.edu")
        self.vehicle = make_vehicle(self.driver, seat_capacity=4)
        self.client.force_authenticate(self.driver)
        self.url = reverse("rides:ride-list")

    def _payload(self, **over):
        base = {
            "vehicle_id": str(self.vehicle.id),
            "origin": "Campus",
            "destination": "Station",
            "origin_latitude": NEAR_A[0],
            "origin_longitude": NEAR_A[1],
            "destination_latitude": FAR[0],
            "destination_longitude": FAR[1],
            "departure_time": (timezone.now() + timedelta(hours=3)).isoformat(),
            "available_seats": 3,
        }
        base.update(over)
        return base

    def test_create_ride_ok(self):
        resp = self.client.post(self.url, self._payload(), format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        ride = Ride.objects.get()
        self.assertEqual(ride.available_seats, 3)
        self.assertEqual(ride.total_seats, 3)
        self.assertIsNotNone(ride.origin_point)

    def test_seats_cannot_exceed_capacity(self):
        resp = self.client.post(self.url, self._payload(available_seats=6), format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data["error"]["code"], "seats_exceed_capacity")

    def test_past_departure_rejected(self):
        past = (timezone.now() - timedelta(hours=1)).isoformat()
        resp = self.client.post(self.url, self._payload(departure_time=past), format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data["error"]["code"], "departure_in_past")

    def test_cannot_use_another_users_vehicle(self):
        other = make_verified_user(admission_number="ADM2", college_email="o@college.edu")
        other_vehicle = make_vehicle(other, registration="KL09ZZ9999")
        resp = self.client.post(
            self.url, self._payload(vehicle_id=str(other_vehicle.id)), format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_inactive_vehicle_rejected(self):
        self.vehicle.is_active = False
        self.vehicle.save(update_fields=["is_active"])
        resp = self.client.post(self.url, self._payload(), format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data["error"]["code"], "vehicle_inactive")


class RideSearchTests(APITestCase):
    def setUp(self):
        self.driver = make_verified_user(admission_number="ADM1", college_email="d@college.edu")
        self.searcher = make_verified_user(admission_number="ADM2", college_email="s@college.edu")
        self.client.force_authenticate(self.searcher)
        self.url = reverse("rides:ride-search")

    def test_proximity_search_returns_near_excludes_far(self):
        near = make_ride(self.driver, origin_coords=NEAR_A)
        # A ride starting far away (Kochi) should be filtered out.
        make_ride(
            self.driver,
            vehicle=make_vehicle(self.driver, registration="KL02BB2222"),
            origin_coords=FAR,
        )
        resp = self.client.get(
            self.url,
            {"origin_lat": NEAR_B[0], "origin_lng": NEAR_B[1], "radius_m": 3000},
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ids = [r["id"] for r in resp.data["results"]]
        self.assertIn(str(near.id), ids)
        self.assertEqual(len(ids), 1)
        self.assertIsNotNone(resp.data["results"][0]["distance_m"])

    def test_search_excludes_own_and_non_open(self):
        make_ride(self.searcher, origin_coords=NEAR_A)  # own ride
        make_ride(self.driver, origin_coords=NEAR_A, status=RideStatus.STARTED)
        resp = self.client.get(self.url, {"origin_lat": NEAR_A[0], "origin_lng": NEAR_A[1]})
        self.assertEqual(resp.data["count"], 0)

    def test_vehicle_type_filter(self):
        make_ride(self.driver, origin_coords=NEAR_A)  # CAR
        bike = make_vehicle(self.driver, registration="KL03CC3333", vehicle_type="BIKE", seat_capacity=1)
        make_ride(self.driver, vehicle=bike, origin_coords=NEAR_A, available_seats=1)
        resp = self.client.get(self.url, {"vehicle_type": "BIKE"})
        self.assertEqual(resp.data["count"], 1)


class RideLifecycleTests(APITestCase):
    def setUp(self):
        self.driver = make_verified_user(admission_number="ADM1", college_email="d@college.edu")
        self.passenger = make_verified_user(admission_number="ADM2", college_email="p@college.edu")
        self.ride = make_ride(self.driver, available_seats=2)

    def test_only_driver_can_start(self):
        self.client.force_authenticate(self.passenger)
        resp = self.client.post(reverse("rides:ride-start", args=[self.ride.id]))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_start_then_complete_updates_counts(self):
        # Book the passenger first so completion bumps their counter.
        from rides.services import accept_request, request_to_join

        req = request_to_join(ride_id=self.ride.id, rider=self.passenger)
        accept_request(request_id=req.id, driver=self.driver)

        self.client.force_authenticate(self.driver)
        start = self.client.post(reverse("rides:ride-start", args=[self.ride.id]))
        self.assertEqual(start.data["status"], RideStatus.STARTED)

        complete = self.client.post(reverse("rides:ride-complete", args=[self.ride.id]))
        self.assertEqual(complete.data["status"], RideStatus.COMPLETED)

        self.assertEqual(
            StudentProfile.objects.get(user=self.driver).completed_rides, 1
        )
        self.assertEqual(
            StudentProfile.objects.get(user=self.passenger).completed_rides, 1
        )

    def test_cannot_complete_before_start(self):
        self.client.force_authenticate(self.driver)
        resp = self.client.post(reverse("rides:ride-complete", args=[self.ride.id]))
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(resp.data["error"]["code"], "invalid_transition")

    def test_cancel_open_ride(self):
        self.client.force_authenticate(self.driver)
        resp = self.client.post(reverse("rides:ride-cancel", args=[self.ride.id]))
        self.assertEqual(resp.data["status"], RideStatus.CANCELLED)

    def test_history_buckets(self):
        make_ride(self.driver, vehicle=make_vehicle(self.driver, registration="KL08XX0808"),
                  status=RideStatus.COMPLETED)
        self.client.force_authenticate(self.driver)
        resp = self.client.get(reverse("rides:ride-history"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("upcoming", resp.data)
        self.assertEqual(len(resp.data["upcoming"]), 1)
        self.assertEqual(len(resp.data["completed"]), 1)
        self.assertEqual(resp.data["upcoming"][0]["role"], "driver")


class DualRoleAccountTests(APITestCase):
    """
    One account, two roles, no stored role flag (mobile role/mode feature).

    There is no Driver/Rider account type and no `role` field on User: driver
    eligibility is derived purely from vehicle ownership, and a ride's "role"
    is computed per-ride, not stored as identity. These tests pin down that a
    single account can hold both roles simultaneously and that a client-side
    UI preference has nothing to do with backend authorization.
    """

    def setUp(self):
        from rides.services import accept_request, request_to_join

        # One account acts as driver on one ride...
        self.user = make_verified_user(admission_number="ADM1", college_email="u@college.edu")
        self.other_driver = make_verified_user(
            admission_number="ADM2", college_email="other@college.edu"
        )
        self.my_ride = make_ride(self.user, available_seats=2)

        # ...and as a confirmed passenger on someone else's ride, at the same time.
        their_ride = make_ride(self.other_driver, available_seats=1)
        req = request_to_join(ride_id=their_ride.id, rider=self.user)
        accept_request(request_id=req.id, driver=self.other_driver)
        self.their_ride = their_ride

    def test_single_account_holds_both_roles_in_history(self):
        """Both roles appear, correctly tagged, for the same account at once."""
        self.client.force_authenticate(self.user)
        resp = self.client.get(reverse("rides:ride-history"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        upcoming_by_id = {r["id"]: r for r in resp.data["upcoming"]}
        self.assertEqual(upcoming_by_id[str(self.my_ride.id)]["role"], "driver")
        self.assertEqual(upcoming_by_id[str(self.their_ride.id)]["role"], "passenger")

    def test_vehicle_ownership_not_a_prior_booking_gates_ride_creation(self):
        """Already being a confirmed passenger elsewhere doesn't block driving."""
        from rides.services import create_ride

        vehicle = make_vehicle(self.user, registration="KL09DUAL1")
        ride = create_ride(
            driver=self.user,
            vehicle_id=vehicle.id,
            origin="Campus",
            destination="Town",
            origin_latitude=NEAR_A[0],
            origin_longitude=NEAR_A[1],
            destination_latitude=FAR[0],
            destination_longitude=FAR[1],
            departure_time=timezone.now() + timedelta(hours=3),
            available_seats=2,
        )
        self.assertEqual(ride.driver_id, self.user.id)

    def test_already_owning_a_vehicle_does_not_block_requesting_to_join(self):
        """Being driver-capable (owns a vehicle) doesn't block riding elsewhere."""
        from rides.services import request_to_join

        make_vehicle(self.user, registration="KL09DUAL2")  # driver-capable now
        another_ride = make_ride(self.other_driver, vehicle=make_vehicle(
            self.other_driver, registration="KL09DUAL3"
        ))
        req = request_to_join(ride_id=another_ride.id, rider=self.user)
        self.assertEqual(req.rider_id, self.user.id)

    def test_no_role_field_exists_on_user_or_profile(self):
        """Guards against a future regression reintroducing a stored role."""
        self.assertFalse(hasattr(self.user, "role"))
        self.assertFalse(hasattr(self.user, "user_type"))
        self.assertFalse(hasattr(self.user.profile, "role"))
