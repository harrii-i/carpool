"""Django Admin — the MVP's admin surface (§6)."""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from .models import CollegeStudent, EmailVerification, StudentProfile, User


@admin.register(CollegeStudent)
class CollegeStudentAdmin(admin.ModelAdmin):
    list_display = ("admission_number", "name", "college_email", "department", "year", "is_active")
    list_filter = ("is_active", "department", "year")
    search_fields = ("admission_number", "name", "college_email")
    ordering = ("admission_number",)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("-date_joined",)
    list_display = ("email", "is_verified", "is_active", "is_staff", "date_joined")
    list_filter = ("is_verified", "is_active", "is_staff", "is_superuser")
    search_fields = ("email",)
    readonly_fields = ("date_joined", "last_login")
    filter_horizontal = ("groups", "user_permissions")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (_("Status"), {"fields": ("is_verified", "is_active")}),
        (_("Permissions"), {"fields": ("is_staff", "is_superuser", "groups", "user_permissions")}),
        (_("Dates"), {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password1", "password2", "is_active", "is_verified"),
            },
        ),
    )


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = ("name", "admission_number", "department", "year", "total_points", "average_rating")
    list_filter = ("department", "year")
    search_fields = ("name", "admission_number", "college_email")
    readonly_fields = ("total_points", "completed_rides", "average_rating")


@admin.register(EmailVerification)
class EmailVerificationAdmin(admin.ModelAdmin):
    list_display = ("user", "is_used", "attempts", "expires_at", "created_at")
    list_filter = ("is_used",)
    search_fields = ("user__email",)
    readonly_fields = ("created_at", "updated_at")
