"""
Seed development data (§45).

Seeds the college registry, two verified accounts, a vehicle for the driver, and
a sample open ride so the core workflow is testable end-to-end:

    Student A (driver)    adm ADM1001  aisha@college.edu    / Passw0rd!123
    Student B (passenger) adm ADM1002  rahul@college.edu    / Passw0rd!123

Safe to run repeatedly — it upserts by admission number / email / registration.
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import CollegeStudent, StudentProfile, User
from rides.models import Ride, RideStatus
from safety.models import EmergencyContact
from vehicles.models import Vehicle, VehicleType

REGISTRY = [
    ("ADM1001", "Aisha Rahman", "aisha@college.edu", "Computer Science", 2),
    ("ADM1002", "Rahul Nair", "rahul@college.edu", "Mechanical Engineering", 3),
    ("ADM1003", "Meera Iyer", "meera@college.edu", "Electronics", 1),
    ("ADM1004", "David Thomas", "david@college.edu", "Computer Science", 4),
]

# Which registry students get a ready-to-use verified account.
SEED_ACCOUNTS = [
    ("ADM1001", "+919810000001"),
    ("ADM1002", "+919810000002"),
]
DEFAULT_PASSWORD = "Passw0rd!123"


class Command(BaseCommand):
    help = "Seed development data (college registry + demo verified accounts)."

    @transaction.atomic
    def handle(self, *args, **options):
        for adm, name, email, dept, year in REGISTRY:
            CollegeStudent.objects.update_or_create(
                admission_number=adm,
                defaults={
                    "name": name,
                    "college_email": email,
                    "department": dept,
                    "year": year,
                    "is_active": True,
                },
            )
        self.stdout.write(self.style.SUCCESS(f"Registry: {len(REGISTRY)} students."))

        for adm, phone in SEED_ACCOUNTS:
            record = CollegeStudent.objects.get(admission_number=adm)
            user, created = User.objects.get_or_create(
                email=record.college_email,
                defaults={"is_active": True, "is_verified": True},
            )
            if created:
                user.set_password(DEFAULT_PASSWORD)
                user.is_active = True
                user.is_verified = True
                user.save()
            StudentProfile.objects.update_or_create(
                user=user,
                defaults={
                    "name": record.name,
                    "admission_number": record.admission_number,
                    "college_email": record.college_email,
                    "department": record.department,
                    "year": record.year,
                    "phone_number": phone,
                },
            )
            EmergencyContact.objects.get_or_create(
                user=user,
                phone_number="+919800000000",
                defaults={"name": "Emergency Contact", "relationship": "Parent", "is_primary": True},
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f"Account: {record.college_email} / {DEFAULT_PASSWORD}"
                )
            )

        # --- A vehicle + a sample open ride for Student A (the driver) ---
        driver = User.objects.get(email="aisha@college.edu")
        vehicle, _ = Vehicle.objects.update_or_create(
            registration_number="KL01AB1234",
            defaults={
                "owner": driver,
                "vehicle_type": VehicleType.CAR,
                "brand": "Toyota",
                "model": "Etios",
                "color": "White",
                "seat_capacity": 4,
                "is_active": True,
            },
        )
        if not Ride.objects.filter(driver=driver, status=RideStatus.OPEN).exists():
            Ride.objects.create(
                driver=driver,
                vehicle=vehicle,
                origin="College Main Gate",
                destination="Central Railway Station",
                origin_latitude=8.5241,
                origin_longitude=76.9366,
                destination_latitude=8.4875,
                destination_longitude=76.9525,
                departure_time=timezone.now() + timedelta(hours=6),
                total_seats=3,
                available_seats=3,
                contribution_amount=50,
                notes="Leaving from the main gate. Bring exact change.",
                status=RideStatus.OPEN,
            )
            self.stdout.write(self.style.SUCCESS("Sample open ride created for the driver."))

        self.stdout.write(self.style.SUCCESS("Done. Log in with a seeded account above."))
