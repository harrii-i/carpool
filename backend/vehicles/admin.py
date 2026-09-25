from django.contrib import admin

from .models import Vehicle


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = (
        "registration_number",
        "vehicle_type",
        "brand",
        "model",
        "owner",
        "seat_capacity",
        "is_active",
    )
    list_filter = ("vehicle_type", "is_active")
    search_fields = ("registration_number", "brand", "model", "owner__email")
    autocomplete_fields = ("owner",)
