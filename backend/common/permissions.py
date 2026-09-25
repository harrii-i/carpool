"""Reusable DRF permission classes."""
from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsVerifiedStudent(BasePermission):
    """Allows access only to authenticated, verified student accounts.

    Verification (college registry + email OTP) is a hard gate for every
    protected operation in the product (§38).
    """

    message = "A verified college student account is required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_verified)


class IsOwnerOrReadOnly(BasePermission):
    """Object-level: only the owner may modify; anyone authorised may read.

    The owning attribute defaults to ``owner`` but views may override it via
    ``owner_field``.
    """

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        owner_field = getattr(view, "owner_field", "owner")
        return getattr(obj, owner_field, None) == request.user
