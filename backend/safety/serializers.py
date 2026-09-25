from rest_framework import serializers

from .models import EmergencyContact, SOSConfig, SOSEvent


class EmergencyContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyContact
        fields = [
            "id",
            "name",
            "phone_number",
            "relationship",
            "is_primary",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class SOSConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = SOSConfig
        fields = [
            "call_primary_contact",
            "send_emergency_message",
            "share_live_location",
            "notify_selected_contacts",
            "notify_college_security",
            "custom_message",
        ]


class SOSEventSerializer(serializers.ModelSerializer):
    ride_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = SOSEvent
        fields = [
            "id",
            "ride_id",
            "latitude",
            "longitude",
            "triggered_at",
            "status",
            "context",
            "created_at",
        ]
        read_only_fields = fields


class TriggerSOSSerializer(serializers.Serializer):
    ride_id = serializers.UUIDField(required=False, allow_null=True)
    latitude = serializers.FloatField(required=False, allow_null=True, min_value=-90, max_value=90)
    longitude = serializers.FloatField(
        required=False, allow_null=True, min_value=-180, max_value=180
    )
