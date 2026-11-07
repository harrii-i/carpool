from django.contrib import admin

from .models import Report


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("reason", "reporter", "reported_user", "ride", "status", "created_at")
    list_filter = ("status", "reason")
    search_fields = ("reporter__email", "reported_user__email", "description")
    autocomplete_fields = ("reporter", "reported_user", "ride")
    readonly_fields = ("reporter", "reported_user", "ride", "reason", "description", "created_at")
    list_editable = ("status",)
