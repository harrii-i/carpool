import { useCallback, useEffect, useRef, useState } from 'react';

import { chatApi } from '@/api/chat';
import { getAccess } from '@/api/tokenStore';
import type { ChatMessage } from '@/api/types';
import { config } from '@/config';

type SocketStatus = 'connecting' | 'open' | 'closed';

/** A message's delivery state (§42: Sending / Sent / Failed). Confirmed
 * history/broadcast messages have no `sendStatus` (they're simply there). */
export type LocalChatMessage = ChatMessage & {
  sendStatus?: 'sending' | 'sent' | 'failed';
  localId?: string;
};

type IncomingMessage = {
  type: string;
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  read_at: string | null;
};

const SEND_TIMEOUT_MS = 8000;
const RECONCILE_WINDOW_MS = 15000;

/**
 * Live chat for one conversation.
 *
 * Loads history over REST, then streams new messages over the WebSocket
 * (`/ws/chat/{id}/?token=`). A sent message appears immediately as "sending";
 * when the server's own broadcast of it arrives back (group_send reaches the
 * sender's socket too) it's reconciled to "sent". If nothing confirms it
 * within a few seconds — or the REST fallback errors outright — it's marked
 * "failed" with a retry affordance (§42).
 */
export function useChatSocket(conversationId: string, currentUserId: string | undefined) {
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const socketRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const addMessage = useCallback((msg: LocalChatMessage) => {
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  }, []);

  const clearSendTimeout = useCallback((localId: string) => {
    const t = timeoutsRef.current.get(localId);
    if (t) {
      clearTimeout(t);
      timeoutsRef.current.delete(localId);
    }
  }, []);

  /** Replace a pending optimistic entry with its confirmed server copy. */
  const reconcile = useCallback(
    (localId: string, confirmed: ChatMessage) => {
      clearSendTimeout(localId);
      setMessages((prev) =>
        prev.map((m) => (m.localId === localId ? { ...confirmed, sendStatus: 'sent' } : m)),
      );
    },
    [clearSendTimeout],
  );

  const markFailed = useCallback((localId: string) => {
    timeoutsRef.current.delete(localId);
    setMessages((prev) =>
      prev.map((m) => (m.localId === localId ? { ...m, sendStatus: 'failed' } : m)),
    );
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    chatApi
      .messages(conversationId)
      .then((history) => {
        if (mountedRef.current) setMessages(history);
      })
      .finally(() => {
        if (mountedRef.current) setLoadingHistory(false);
      });

    const token = getAccess();
    const url = `${config.wsBase}/ws/chat/${conversationId}/?token=${token ?? ''}`;
    const ws = new WebSocket(url);
    socketRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => mountedRef.current && setStatus('open');
    ws.onclose = () => mountedRef.current && setStatus('closed');
    ws.onerror = () => mountedRef.current && setStatus('closed');
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as IncomingMessage;
        if (data.type !== 'message') return;

        const confirmed: ChatMessage = {
          id: data.id,
          conversation: data.conversation_id,
          sender_id: data.sender_id,
          message: data.message,
          is_mine: !!currentUserId && data.sender_id === currentUserId,
          created_at: data.created_at,
          read_at: data.read_at,
        };

        if (confirmed.is_mine) {
          // Reconcile against the oldest still-"sending" optimistic entry with
          // the same text, within a short window — this is our own echo.
          const now = Date.now();
          let reconciled = false;
          setMessages((prev) => {
            const match = prev.find(
              (m) =>
                m.sendStatus === 'sending' &&
                m.message === confirmed.message &&
                now - new Date(m.created_at).getTime() < RECONCILE_WINDOW_MS,
            );
            if (!match?.localId) return prev;
            reconciled = true;
            clearSendTimeout(match.localId);
            return prev.map((m) =>
              m.localId === match.localId ? { ...confirmed, sendStatus: 'sent' } : m,
            );
          });
          if (reconciled) return;
        }

        addMessage(confirmed);
      } catch {
        // ignore malformed frames
      }
    };

    void chatApi.markRead(conversationId).catch(() => undefined);

    return () => {
      mountedRef.current = false;
      ws.close();
      socketRef.current = null;
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, currentUserId]);

  const sendText = useCallback(
    async (text: string, localId: string) => {
      const ws = socketRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ action: 'message', message: text }));
        } catch {
          markFailed(localId);
          return;
        }
        // No per-message ack over the socket — fail fast if nothing confirms
        // it (via the broadcast echo) within a few seconds.
        const timeout = setTimeout(() => markFailed(localId), SEND_TIMEOUT_MS);
        timeoutsRef.current.set(localId, timeout);
      } else {
        try {
          const msg = await chatApi.send(conversationId, text);
          reconcile(localId, msg);
        } catch {
          markFailed(localId);
        }
      }
    },
    [conversationId, markFailed, reconcile],
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      addMessage({
        id: localId,
        localId,
        conversation: conversationId,
        sender_id: currentUserId ?? '',
        message: trimmed,
        is_mine: true,
        created_at: new Date().toISOString(),
        read_at: null,
        sendStatus: 'sending',
      });
      void sendText(trimmed, localId);
    },
    [addMessage, conversationId, currentUserId, sendText],
  );

  const retry = useCallback(
    (localId: string) => {
      const target = messages.find((m) => m.localId === localId);
      if (!target) return;
      setMessages((prev) =>
        prev.map((m) => (m.localId === localId ? { ...m, sendStatus: 'sending' } : m)),
      );
      void sendText(target.message, localId);
    },
    [messages, sendText],
  );

  return { messages, status, send, retry, loadingHistory };
}
