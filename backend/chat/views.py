"""Chat REST API (§20).

Conversations are read-only collections here; messages can be listed (history)
and sent over REST (a fallback for the WebSocket path). Access is restricted to
confirmed participants.
"""
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from common.permissions import IsVerifiedStudent

from . import services
from .models import Conversation, Message
from .serializers import (
    ConversationSerializer,
    MessageSerializer,
    SendMessageSerializer,
)


class ConversationViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    permission_classes = [IsVerifiedStudent]
    serializer_class = ConversationSerializer

    def get_queryset(self):
        # Only conversations the caller participates in (§38).
        return (
            Conversation.objects.select_related("ride")
            .filter(participants__user=self.request.user)
            .distinct()
        )

    @action(detail=True, methods=["get", "post"])
    def messages(self, request, pk=None):
        conversation = self.get_object()  # 404s for non-participants

        if request.method == "POST":
            serializer = SendMessageSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            message = services.create_message(
                conversation_id=conversation.id,
                sender=request.user,
                text=serializer.validated_data["message"],
            )
            return Response(
                MessageSerializer(message, context={"request": request}).data,
                status=status.HTTP_201_CREATED,
            )

        qs = Message.objects.filter(conversation=conversation).select_related("sender")
        page = self.paginate_queryset(qs)
        serializer = MessageSerializer(page, many=True, context={"request": request})
        return self.get_paginated_response(serializer.data)

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        conversation = self.get_object()
        marked = services.mark_read(conversation_id=conversation.id, user=request.user)
        return Response({"marked_read": marked})
