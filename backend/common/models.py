"""Abstract base models reused across every domain app."""
import uuid

from django.db import models


class TimeStampedModel(models.Model):
    """Adds self-managing ``created_at`` / ``updated_at`` columns."""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UUIDModel(models.Model):
    """Uses a non-sequential UUID primary key.

    Non-guessable identifiers keep ride / user IDs from being enumerable in the
    API surface, which matters for a product handling student identity and
    live location.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class BaseModel(UUIDModel, TimeStampedModel):
    """UUID primary key + timestamps: the default base for domain models."""

    class Meta:
        abstract = True
