"""Test helpers for rides."""
from __future__ import annotations

import itertools
from datetime import timedelta

from django.utils import timezone

from rides.models import Ride, RideStatus
from vehicles.models import Vehicle

# Two nearby points (Trivandrum) and one far point (Kochi) for proximity tests.
NEAR_A = (8.5241, 76.9366)
NEAR_B = (8.5300, 76.9400)
FAR = (9.9312, 76.2673)

_reg_counter = itertools.count(1)


def make_vehicle(owner, registration=None, seat_capacity=4, vehicle_type="CAR"):
    if registration is None:
        registration = f"KL01AA{next(_reg_counter):04d}"
    return Vehicle.objects.create(
        owner=owner,
        vehicle_type=vehicle_type,
        brand="Toyota",
        model="Etios",
        registration_number=registration,
        color="White",
        seat_capacity=seat_capacity,
    )


def make_ride(
    driver,
    vehicle=None,
    *,
    origin_coords=NEAR_A,
    destination_coords=FAR,
    available_seats=3,
    hours_ahead=5,
    status=RideStatus.OPEN,
):
    vehicle = vehicle or make_vehicle(driver)
    olat, olng = origin_coords
    dlat, dlng = destination_coords
    return Ride.objects.create(
        driver=driver,
        vehicle=vehicle,
        origin="Campus Gate",
        destination="City Center",
        origin_latitude=olat,
        origin_longitude=olng,
        destination_latitude=dlat,
        destination_longitude=dlng,
        departure_time=timezone.now() + timedelta(hours=hours_ahead),
        total_seats=available_seats,
        available_seats=available_seats,
        status=status,
    )
