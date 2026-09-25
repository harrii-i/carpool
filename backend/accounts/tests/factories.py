"""Small helpers for building test fixtures without extra dependencies."""
from __future__ import annotations

from accounts.models import CollegeStudent, StudentProfile, User


def make_registry_student(
    admission_number: str = "ADM1001",
    name: str = "Aisha Rahman",
    college_email: str = "aisha@college.edu",
    department: str = "Computer Science",
    year: int = 2,
    is_active: bool = True,
) -> CollegeStudent:
    return CollegeStudent.objects.create(
        admission_number=admission_number,
        name=name,
        college_email=college_email,
        department=department,
        year=year,
        is_active=is_active,
    )


def make_verified_user(
    admission_number: str = "ADM2002",
    college_email: str = "verified@college.edu",
    password: str = "StrongPassw0rd!",
    name: str = "Verified User",
) -> User:
    """Create a fully verified, active user with a profile (bypasses OTP)."""
    user = User.objects.create_user(
        email=college_email, password=password, is_active=True, is_verified=True
    )
    StudentProfile.objects.create(
        user=user,
        name=name,
        admission_number=admission_number,
        college_email=college_email,
        department="Computer Science",
        year=2,
        phone_number="+919000000000",
    )
    return user
