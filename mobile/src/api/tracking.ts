import { api } from './client';
import { Paginated, ShareSession } from './types';

export const trackingApi = {
  async createSession(rideId: string): Promise<ShareSession> {
    const { data } = await api.post<ShareSession>('/tracking/sessions/', { ride_id: rideId });
    return data;
  },

  async list(): Promise<ShareSession[]> {
    const { data } = await api.get<Paginated<ShareSession>>('/tracking/sessions/');
    return data.results;
  },

  async revoke(id: string): Promise<ShareSession> {
    const { data } = await api.post<ShareSession>(`/tracking/sessions/${id}/revoke/`);
    return data;
  },
};
