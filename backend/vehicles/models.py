"""Vehicle domain models."""
from django.conf import settings
from django.db import models

from common.models import BaseModel


class VehicleType(models.TextChoices):
    BIKE = "BIKE", "Bike"
    CAR = "CAR", "Car"


class Vehicle(BaseModel):
    """A bike or car a student can offer rides with.

    Registration numbers are globally unique. Vehicles are deactivated rather
    than deleted so historical rides keep referring to a valid record (§10).
    """

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="vehicles"
    )
    vehicle_type = models.CharField(max_length=4, choices=VehicleType.choices)
    brand = models.CharField(max_length=60)
    model = models.CharField(max_length=60)
    registration_number = models.CharField(max_length=20, unique=True, db_index=True)
    color = models.CharField(max_length=30)
    seat_capacity = models.PositiveSmallIntegerField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.brand} {self.model} ({self.registration_number})"

    def save(self, *args, **kwargs):
        # Registration numbers are compared case-insensitively; store upper-case.
        self.registration_number = self.registration_number.upper().strip()
        super().save(*args, **kwargs)
