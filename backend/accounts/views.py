"""Auth API views. Thin: parse -> call service -> shape response."""
from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from . import services
from .serializers import (
    EmailTokenObtainPairSerializer,
    MeSerializer,
    RegisterSerializer,
    ResendVerificationSerializer,
    VerifyEmailSerializer,
)


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth_register"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.register_student(**serializer.validated_data)
        return Response(
            {
                "detail": "Registration successful. Check your college email for a "
                "verification code.",
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth_verify"

    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.verify_email(**serializer.validated_data)

        # Issue tokens on successful verification so the client can proceed
        # straight into the app.
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "detail": "Email verified.",
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_200_OK,
        )


class ResendVerificationView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth_resend"

    def post(self, request):
        serializer = ResendVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.resend_verification(**serializer.validated_data)
        # Uniform response regardless of whether the email exists (§43).
        return Response(
            {"detail": "If the account exists and is unverified, a code has been sent."},
            status=status.HTTP_200_OK,
        )


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    throttle_scope = "auth_login"
    serializer_class = EmailTokenObtainPairSerializer


class LogoutView(APIView):
    """Blacklist the supplied refresh token (§8)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh = request.data.get("refresh")
        if not refresh:
            return Response(
                {"error": {"code": "missing_refresh", "message": "refresh token required."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            RefreshToken(refresh).blacklist()
        except TokenError:
            return Response(
                {"error": {"code": "invalid_token", "message": "Invalid or expired token."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_205_RESET_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Pass request context so any ImageField (profile_image) serializes to
        # an absolute URL — without it, DRF returns a bare relative path that
        # the mobile app can't resolve into a loadable image.
        return Response(MeSerializer(request.user, context={"request": request}).data)
