from rest_framework import serializers

from .models import PointsTransaction, Rating


class PointsTransactionSerializer(serializers.ModelSerializer):
    ride_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = PointsTransaction
        fields = ["id", "ride_id", "points", "transaction_type", "description", "created_at"]
        read_only_fields = fields


class RatingSerializer(serializers.ModelSerializer):
    reviewer_id = serializers.UUIDField(read_only=True)
    reviewee_id = serializers.UUIDField(read_only=True)
    ride_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = Rating
        fields = ["id", "ride_id", "reviewer_id", "reviewee_id", "rating", "comment", "created_at"]
        read_only_fields = fields


class CreateRatingSerializer(serializers.Serializer):
    ride_id = serializers.UUIDField()
    reviewee_id = serializers.UUIDField()
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(required=False, allow_blank=True, default="", max_length=1000)
