from django.contrib import admin

from .models import Booking, Ride, RideRequest


class RideRequestInline(admin.TabularInline):
    model = RideRequest
    extra = 0
    fields = ("rider", "status", "created_at")
    readonly_fields = ("created_at",)
    autocomplete_fields = ("rider",)


class BookingInline(admin.TabularInline):
    model = Booking
    extra = 0
    fields = ("passenger", "status", "created_at")
    readonly_fields = ("created_at",)
    autocomplete_fields = ("passenger",)


@admin.register(Ride)
class RideAdmin(admin.ModelAdmin):
    list_display = (
        "__str__",
        "driver",
        "status",
        "available_seats",
        "total_seats",
        "departure_time",
    )
    list_filter = ("status", "departure_time")
    search_fields = ("origin", "destination", "driver__email")
    autocomplete_fields = ("driver", "vehicle")
    readonly_fields = ("started_at", "completed_at", "cancelled_at", "created_at", "updated_at")
    inlines = [RideRequestInline, BookingInline]


@admin.register(RideRequest)
class RideRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "ride", "rider", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("rider__email",)
    autocomplete_fields = ("ride", "rider")


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("id", "ride", "passenger", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("passenger__email",)
    autocomplete_fields = ("ride", "passenger")
