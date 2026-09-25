"""
Account domain services.

All registration / verification business rules live here so that views and
serializers stay thin (§37, §50). Functions raise ``DomainError`` subclasses
on rule violations; the API layer renders them uniformly.
"""
from __future__ import annotations

import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from common.exceptions import ConflictError, NotFoundError, ValidationError

from .models import CollegeStudent, EmailVerification, StudentProfile, User


# ---------------------------------------------------------------------------
# OTP helpers
# ---------------------------------------------------------------------------
def generate_otp(length: int | None = None) -> str:
    """Return a numeric one-time code of the configured length."""
    length = length or settings.OTP_LENGTH
    # secrets.randbelow avoids modulo bias; zero-padded to a fixed width.
    upper = 10**length
    return str(secrets.randbelow(upper)).zfill(length)


def _issue_verification(user: User) -> EmailVerification:
    """Create and email a fresh OTP, invalidating any earlier unused ones."""
    EmailVerification.objects.filter(user=user, is_used=False).update(is_used=True)

    code = generate_otp()
    verification = EmailVerification.objects.create(
        user=user,
        code=code,
        expires_at=timezone.now() + timedelta(minutes=settings.OTP_TTL_MINUTES),
    )
    _send_otp_email(user.email, code)
    return verification


def _send_otp_email(email: str, code: str) -> None:
    send_mail(
        subject="Your College Carpool verification code",
        message=(
            f"Your verification code is {code}.\n"
            f"It expires in {settings.OTP_TTL_MINUTES} minutes.\n\n"
            "If you did not request this, you can ignore this email."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------
@transaction.atomic
def register_student(
    *,
    admission_number: str,
    college_email: str,
    phone_number: str,
    password: str,
) -> User:
    """Register a new student against the college registry.

    Fails when the admission number is unknown, the registry record is
    inactive, the email does not match the registry, or the student has already
    registered (§7). Identity fields are taken from the registry, never from
    client input.
    """
    admission_number = admission_number.strip()
    college_email = college_email.strip().lower()

    try:
        record = CollegeStudent.objects.get(admission_number__iexact=admission_number)
    except CollegeStudent.DoesNotExist:
        raise NotFoundError(
            "No college record found for this admission number.",
            code="admission_not_found",
        )

    if not record.is_active:
        raise ValidationError(
            "This college record is inactive. Contact the college office.",
            code="admission_inactive",
        )

    # The provided email must match the registry to prevent identity hijacking.
    if record.college_email.lower() != college_email:
        raise ValidationError(
            "The college email does not match our records for this admission "
            "number.",
            code="email_mismatch",
        )

    if StudentProfile.objects.filter(admission_number__iexact=admission_number).exists():
        raise ConflictError(
            "This admission number has already been registered.",
            code="already_registered",
        )
    if User.objects.filter(email__iexact=college_email).exists():
        raise ConflictError(
            "An account with this email already exists.",
            code="email_taken",
        )

    user = User.objects.create_user(
        email=record.college_email,
        password=password,
        is_active=False,
        is_verified=False,
    )

    # Identity is derived from the trusted registry record.
    StudentProfile.objects.create(
        user=user,
        name=record.name,
        admission_number=record.admission_number,
        college_email=record.college_email,
        department=record.department,
        year=record.year,
        phone_number=phone_number.strip(),
    )

    _issue_verification(user)
    return user


# ---------------------------------------------------------------------------
# Email verification
# ---------------------------------------------------------------------------
def verify_email(*, email: str, code: str) -> User:
    """Verify an account with an OTP, activating it on success (§7).

    This function is intentionally *not* wrapped in a single atomic block:
    failure-path writes (incrementing ``attempts``, locking out after too many
    tries) must be committed even though the request then raises. Only the
    success mutation — marking the code used and activating the account — needs
    to be atomic, and it is wrapped explicitly below.
    """
    email = email.strip().lower()
    code = code.strip()

    try:
        user = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        raise NotFoundError("No account found for this email.", code="user_not_found")

    if user.is_verified:
        raise ConflictError("This account is already verified.", code="already_verified")

    verification = (
        EmailVerification.objects.filter(user=user, is_used=False)
        .order_by("-created_at")
        .first()
    )
    if verification is None:
        raise ValidationError(
            "No active verification code. Request a new one.",
            code="no_active_code",
        )

    if verification.is_expired:
        raise ValidationError("This code has expired. Request a new one.", code="code_expired")

    if verification.attempts >= settings.OTP_MAX_ATTEMPTS:
        verification.is_used = True
        verification.save(update_fields=["is_used"])  # persists (autocommit)
        raise ValidationError(
            "Too many incorrect attempts. Request a new code.",
            code="too_many_attempts",
        )

    if not secrets.compare_digest(verification.code, code):
        verification.attempts += 1
        verification.save(update_fields=["attempts"])  # persists (autocommit)
        raise ValidationError("Incorrect verification code.", code="invalid_code")

    with transaction.atomic():
        verification.is_used = True
        verification.save(update_fields=["is_used"])
        user.is_verified = True
        user.is_active = True
        user.save(update_fields=["is_verified", "is_active"])
    return user


@transaction.atomic
def resend_verification(*, email: str) -> None:
    """Re-issue an OTP for an unverified account.

    Silently succeeds for unknown / already-verified emails to avoid leaking
    which addresses have accounts (account-enumeration hardening, §43).
    """
    email = email.strip().lower()
    user = User.objects.filter(email__iexact=email, is_verified=False).first()
    if user is not None:
        _issue_verification(user)
