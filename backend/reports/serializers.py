from rest_framework import serializers

from .models import Report


class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = [
            "id",
            "reported_user",
            "ride",
            "reason",
            "description",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "status", "created_at"]

    def validate(self, attrs):
        if not attrs.get("reported_user") and not attrs.get("ride"):
            raise serializers.ValidationError(
                "A report must reference a user or a ride."
            )
        reporter = self.context["request"].user
        if attrs.get("reported_user") == reporter:
            raise serializers.ValidationError("You cannot report yourself.")
        return attrs
