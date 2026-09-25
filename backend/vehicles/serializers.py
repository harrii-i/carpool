from rest_framework import serializers

from .models import Vehicle


class VehicleSerializer(serializers.ModelSerializer):
    """Full vehicle representation for the owner's own CRUD."""

    vehicle_type_display = serializers.CharField(
        source="get_vehicle_type_display", read_only=True
    )

    class Meta:
        model = Vehicle
        fields = [
            "id",
            "vehicle_type",
            "vehicle_type_display",
            "brand",
            "model",
            "registration_number",
            "color",
            "seat_capacity",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate_seat_capacity(self, value: int) -> int:
        if value < 1:
            raise serializers.ValidationError("Seat capacity must be at least 1.")
        if value > 8:
            raise serializers.ValidationError("Seat capacity looks too high for a bike/car.")
        return value

    def validate_registration_number(self, value: str) -> str:
        normalized = value.upper().strip()
        qs = Vehicle.objects.filter(registration_number=normalized)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "A vehicle with this registration number already exists."
            )
        return normalized


class VehicleSummarySerializer(serializers.ModelSerializer):
    """Compact vehicle view embedded in ride payloads (§14)."""

    vehicle_type_display = serializers.CharField(
        source="get_vehicle_type_display", read_only=True
    )

    class Meta:
        model = Vehicle
        fields = [
            "id",
            "vehicle_type",
            "vehicle_type_display",
            "brand",
            "model",
            "color",
            "registration_number",
        ]
