import { api } from './client';
import { ChatMessage, Conversation, Paginated } from './types';

export const chatApi = {
  async conversations(): Promise<Conversation[]> {
    const { data } = await api.get<Paginated<Conversation>>('/chat/conversations/');
    return data.results;
  },

  async messages(conversationId: string): Promise<ChatMessage[]> {
    const { data } = await api.get<Paginated<ChatMessage>>(
      `/chat/conversations/${conversationId}/messages/`,
    );
    return data.results;
  },

  async send(conversationId: string, message: string): Promise<ChatMessage> {
    const { data } = await api.post<ChatMessage>(
      `/chat/conversations/${conversationId}/messages/`,
      { message },
    );
    return data;
  },

  async markRead(conversationId: string): Promise<void> {
    await api.post(`/chat/conversations/${conversationId}/read/`);
  },
};
