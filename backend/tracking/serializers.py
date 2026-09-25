from rest_framework import serializers

from .models import RideShareSession
from .services import build_share_url


class ShareSessionSerializer(serializers.ModelSerializer):
    ride_id = serializers.UUIDField(read_only=True)
    share_url = serializers.SerializerMethodField()

    class Meta:
        model = RideShareSession
        fields = [
            "id",
            "ride_id",
            "share_token",
            "share_url",
            "expires_at",
            "is_active",
            "created_at",
            "ended_at",
        ]
        read_only_fields = fields

    def get_share_url(self, obj) -> str:
        return build_share_url(obj.share_token)


class CreateShareSessionSerializer(serializers.Serializer):
    ride_id = serializers.UUIDField()


class LocationUpdateSerializer(serializers.Serializer):
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)
    speed = serializers.FloatField(required=False, allow_null=True)
    heading = serializers.FloatField(required=False, allow_null=True)
    timestamp = serializers.DateTimeField(required=False, allow_null=True)
