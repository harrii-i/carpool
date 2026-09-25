"""Serializers for the accounts API (validation + shaping only)."""
from __future__ import annotations

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import StudentProfile, User


class RegisterSerializer(serializers.Serializer):
    """Input for POST /api/auth/register/.

    Name / department / year / college identity come from the registry, so the
    client only supplies the fields below. ``password`` is write-only and run
    through Django's validators.
    """

    admission_number = serializers.CharField(max_length=32)
    college_email = serializers.EmailField()
    phone_number = serializers.CharField(max_length=20)
    password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)

    def validate_password(self, value: str) -> str:
        validate_password(value)
        return value


class VerifyEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=10)


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()


class StudentProfileSerializer(serializers.ModelSerializer):
    """Read view of the student's own profile."""

    year_display = serializers.CharField(source="get_year_display", read_only=True)

    class Meta:
        model = StudentProfile
        fields = [
            "id",
            "name",
            "admission_number",
            "college_email",
            "department",
            "year",
            "year_display",
            "phone_number",
            "profile_image",
            "total_points",
            "completed_rides",
            "average_rating",
            "created_at",
        ]
        read_only_fields = fields  # editing handled by dedicated profile endpoints


class MeSerializer(serializers.ModelSerializer):
    """Payload for GET /api/auth/me/ — the user plus embedded profile."""

    profile = StudentProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "is_verified", "date_joined", "profile"]
        read_only_fields = fields


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Login serializer.

    SimpleJWT already authenticates against ``USERNAME_FIELD`` (email) and
    rejects inactive users. We add a clearer message for the unverified case
    and embed a couple of convenience claims.
    """

    username_field = User.USERNAME_FIELD

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["is_verified"] = user.is_verified
        return token

    def validate(self, attrs):
        try:
            data = super().validate(attrs)
        except Exception:
            # Inactive (unverified) or bad credentials both surface here as an
            # auth failure (401). Give a targeted hint when the account merely
            # needs verification so the client can route to the verify screen.
            user = User.objects.filter(
                email__iexact=attrs.get(self.username_field, "").lower()
            ).first()
            if user and not user.is_verified:
                raise AuthenticationFailed(
                    "Account not verified. Please verify your email.",
                    code="not_verified",
                )
            raise
        return data
