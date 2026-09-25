from django.contrib import admin

from .models import EmergencyContact, SOSConfig, SOSEvent


@admin.register(EmergencyContact)
class EmergencyContactAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "phone_number", "relationship", "is_primary", "is_active")
    list_filter = ("is_primary", "is_active")
    search_fields = ("name", "phone_number", "user__email")
    autocomplete_fields = ("user",)


@admin.register(SOSConfig)
class SOSConfigAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "call_primary_contact",
        "send_emergency_message",
        "share_live_location",
        "notify_college_security",
    )
    search_fields = ("user__email",)
    autocomplete_fields = ("user",)


@admin.register(SOSEvent)
class SOSEventAdmin(admin.ModelAdmin):
    """SOS review (§6). Events are immutable except the status workflow field."""

    list_display = ("id", "user", "ride", "status", "triggered_at")
    list_filter = ("status",)
    search_fields = ("user__email",)
    readonly_fields = (
        "user",
        "ride",
        "latitude",
        "longitude",
        "triggered_at",
        "context",
        "created_at",
        "updated_at",
    )
    autocomplete_fields = ("user", "ride")
