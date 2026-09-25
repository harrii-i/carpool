from django.contrib import admin

from .models import LocationSnapshot, RideShareSession


@admin.register(RideShareSession)
class RideShareSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "ride", "created_by", "is_active", "expires_at", "ended_at")
    list_filter = ("is_active",)
    search_fields = ("share_token", "created_by__email")
    autocomplete_fields = ("ride", "created_by")
    readonly_fields = ("share_token", "created_at", "updated_at", "ended_at")


@admin.register(LocationSnapshot)
class LocationSnapshotAdmin(admin.ModelAdmin):
    list_display = ("id", "ride", "latitude", "longitude", "recorded_at")
    search_fields = ("ride__id",)
    autocomplete_fields = ("ride",)
