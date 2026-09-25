"""
Seed development data (§45).

Phase 1 seeds the college registry plus two verified accounts so the auth flow
is testable end-to-end:

    Student A (driver)    adm ADM1001  aisha@college.edu    / Passw0rd!123
    Student B (passenger) adm ADM1002  rahul@college.edu    / Passw0rd!123

Vehicles and rides are added to this command as those phases land. Safe to run
repeatedly — it upserts by admission number / email.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import CollegeStudent, StudentProfile, User

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
            self.stdout.write(
                self.style.SUCCESS(
                    f"Account: {record.college_email} / {DEFAULT_PASSWORD}"
                )
            )

        self.stdout.write(self.style.SUCCESS("Done. Log in with a seeded account above."))
