from django.contrib import admin

from .models import Conversation, ConversationParticipant, Message


class ParticipantInline(admin.TabularInline):
    model = ConversationParticipant
    extra = 0
    autocomplete_fields = ("user",)


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "ride", "created_at")
    search_fields = ("ride__origin", "ride__destination")
    autocomplete_fields = ("ride",)
    inlines = [ParticipantInline]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "conversation", "sender", "created_at", "read_at")
    search_fields = ("sender__email", "message")
    autocomplete_fields = ("conversation", "sender")
