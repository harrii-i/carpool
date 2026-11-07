from django.contrib import admin

from .models import PointsTransaction, Rating


@admin.register(PointsTransaction)
class PointsTransactionAdmin(admin.ModelAdmin):
    list_display = ("user", "points", "transaction_type", "ride", "created_at")
    list_filter = ("transaction_type",)
    search_fields = ("user__email",)
    autocomplete_fields = ("user", "ride")
    readonly_fields = ("created_at", "updated_at")


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ("ride", "reviewer", "reviewee", "rating", "created_at")
    list_filter = ("rating",)
    search_fields = ("reviewer__email", "reviewee__email")
    autocomplete_fields = ("ride", "reviewer", "reviewee")
