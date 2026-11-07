"""Student profile endpoints (/api/profile/)."""
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import ProfileUpdateSerializer, StudentProfileSerializer


class ProfileView(APIView):
    """GET the current student's profile; PATCH the editable fields (§9)."""

    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        # Pass request context so profile_image serializes to an absolute URL
        # (otherwise DRF returns a bare relative path the client can't load).
        return Response(
            StudentProfileSerializer(request.user.profile, context={"request": request}).data
        )

    def patch(self, request):
        serializer = ProfileUpdateSerializer(
            request.user.profile, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            StudentProfileSerializer(request.user.profile, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )
