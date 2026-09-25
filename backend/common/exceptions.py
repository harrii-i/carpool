"""
Shared exceptions and a uniform API error envelope.

Domain/service code raises ``DomainError`` (or a subclass) to signal a business
rule violation. The custom exception handler renders every error as:

    {"error": {"code": "<slug>", "message": "<human readable>", "detail": ...}}

so the mobile client can branch on a stable ``code`` instead of parsing prose.
"""
from __future__ import annotations

from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler as drf_exception_handler


class DomainError(APIException):
    """Base class for business-rule violations raised by service functions."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "The request could not be completed."
    default_code = "domain_error"

    def __init__(self, message: str | None = None, code: str | None = None):
        self.code = code or self.default_code
        super().__init__(detail=message or self.default_detail)


class ValidationError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "validation_error"


class ConflictError(DomainError):
    status_code = status.HTTP_409_CONFLICT
    default_code = "conflict"


class PermissionDeniedError(DomainError):
    status_code = status.HTTP_403_FORBIDDEN
    default_code = "permission_denied"


class NotFoundError(DomainError):
    status_code = status.HTTP_404_NOT_FOUND
    default_code = "not_found"


def api_exception_handler(exc, context):
    """Wrap DRF's default handler output in a consistent ``error`` envelope."""
    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    code = getattr(exc, "code", None) or getattr(exc, "default_code", "error")
    data = response.data

    if isinstance(data, dict) and "detail" in data and len(data) == 1:
        message = str(data["detail"])
        detail = None
    else:
        # Field validation errors: keep the field map as structured detail.
        message = "Validation failed."
        detail = data

    response.data = {"error": {"code": code, "message": message}}
    if detail is not None:
        response.data["error"]["detail"] = detail
    return response
