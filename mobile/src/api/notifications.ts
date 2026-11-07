import { api } from './client';
import { AppNotification, Paginated } from './types';

export const notificationsApi = {
  async list(): Promise<AppNotification[]> {
    const { data } = await api.get<Paginated<AppNotification>>('/notifications/');
    return data.results;
  },

  async unreadCount(): Promise<number> {
    const { data } = await api.get<{ unread_count: number }>('/notifications/unread_count/');
    return data.unread_count;
  },

  async markRead(id: string): Promise<void> {
    await api.post(`/notifications/${id}/read/`);
  },

  async markAllRead(): Promise<void> {
    await api.post('/notifications/read_all/');
  },
};
