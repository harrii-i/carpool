"""
Accounts domain models.

    CollegeStudent   — the authoritative registry of enrolled students. The
                       source of truth for who may register (§7).
    User             — the authentication principal, identified by college
                       email. Inactive until email is verified.
    StudentProfile   — public/product profile; verified identity fields are
                       copied from the registry and are not client-editable.
    EmailVerification— short-lived OTP codes for email verification.
"""
from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone

from common.models import BaseModel, TimeStampedModel

from .managers import UserManager


class YearChoices(models.IntegerChoices):
    FIRST = 1, "1st Year"
    SECOND = 2, "2nd Year"
    THIRD = 3, "3rd Year"
    FOURTH = 4, "4th Year"
    FIFTH = 5, "5th Year"


class CollegeStudent(BaseModel):
    """Registry of students actually enrolled at the college.

    Registration is only permitted for an ``admission_number`` that exists here
    and is active. Name / email / department / year are derived from this
    record rather than trusted from client input (§7).
    """

    admission_number = models.CharField(max_length=32, unique=True, db_index=True)
    name = models.CharField(max_length=150)
    college_email = models.EmailField(db_index=True)
    department = models.CharField(max_length=100)
    year = models.IntegerField(choices=YearChoices.choices)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "College student (registry)"
        verbose_name_plural = "College students (registry)"
        ordering = ["admission_number"]

    def __str__(self) -> str:
        return f"{self.admission_number} — {self.name}"


class User(AbstractBaseUser, PermissionsMixin, BaseModel):
    """Custom user identified by college email.

    ``is_active`` stays False until the email OTP is verified, so unverified
    accounts cannot authenticate. ``is_verified`` records that the college
    identity + email check passed.
    """

    email = models.EmailField(unique=True, db_index=True)
    is_active = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        ordering = ["-date_joined"]

    def __str__(self) -> str:
        return self.email


class StudentProfile(BaseModel):
    """Product profile for a verified student.

    Verified identity fields (name, admission_number, college_email,
    department, year) are copied from CollegeStudent and must not be edited by
    the client. Reputation fields are maintained by trusted backend logic.
    """

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="profile"
    )

    # --- Verified identity (not client-editable) ---
    name = models.CharField(max_length=150)
    admission_number = models.CharField(max_length=32, unique=True, db_index=True)
    college_email = models.EmailField(db_index=True)
    department = models.CharField(max_length=100)
    year = models.IntegerField(choices=YearChoices.choices)

    # --- Editable by the student ---
    phone_number = models.CharField(max_length=20)
    profile_image = models.ImageField(
        upload_to="profiles/", null=True, blank=True
    )

    # --- Reputation (maintained by backend services only) ---
    total_points = models.PositiveIntegerField(default=0)
    completed_rides = models.PositiveIntegerField(default=0)
    average_rating = models.DecimalField(
        max_digits=3, decimal_places=2, default=0
    )

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.admission_number})"


class EmailVerification(TimeStampedModel):
    """A one-time verification code sent to a user's college email.

    Codes are single-use and expire. The plain code is stored because it is
    short-lived, low-entropy, and only meaningful alongside the account; it is
    never logged (§43).
    """

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="verifications"
    )
    code = models.CharField(max_length=10)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    attempts = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "is_used"])]

    def __str__(self) -> str:
        return f"Verification for {self.user.email} (used={self.is_used})"

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    def is_valid(self) -> bool:
        return not self.is_used and not self.is_expired
