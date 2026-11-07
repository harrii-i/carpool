"""
Reputation models (§31, §32).

    PointsTransaction — an append-only ledger; a user's total is the sum of their
                        transactions (also mirrored on StudentProfile for reads).
    Rating           — one rating per (ride, reviewer, reviewee); averages are
                        computed on the backend.
"""
from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from common.models import BaseModel


class PointsTransactionType(models.TextChoices):
    DRIVER_COMPLETION = "DRIVER_COMPLETION", "Driver completed ride"
    PASSENGER_COMPLETION = "PASSENGER_COMPLETION", "Passenger completed ride"
    ADJUSTMENT = "ADJUSTMENT", "Manual adjustment"


class PointsTransaction(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="points_transactions"
    )
    ride = models.ForeignKey(
        "rides.Ride", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="points_transactions",
    )
    points = models.IntegerField()
    transaction_type = models.CharField(max_length=24, choices=PointsTransactionType.choices)
    description = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "created_at"])]
        constraints = [
            # A ride awards a given user points at most once per type (idempotent
            # completion, §31: no double-awards).
            models.UniqueConstraint(
                fields=["user", "ride", "transaction_type"],
                name="uniq_points_per_user_ride_type",
            )
        ]

    def __str__(self) -> str:
        return f"{self.points:+d} to {self.user_id} ({self.transaction_type})"


class Rating(BaseModel):
    ride = models.ForeignKey("rides.Ride", on_delete=models.CASCADE, related_name="ratings")
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ratings_given"
    )
    reviewee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ratings_received"
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["reviewee"])]
        constraints = [
            models.UniqueConstraint(
                fields=["ride", "reviewer", "reviewee"],
                name="uniq_rating_per_ride_reviewer_reviewee",
            ),
            models.CheckConstraint(
                check=~models.Q(reviewer=models.F("reviewee")),
                name="rating_no_self_review",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.reviewer_id} -> {self.reviewee_id}: {self.rating}"
