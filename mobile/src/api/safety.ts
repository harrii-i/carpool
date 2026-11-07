import { api } from './client';
import {
  EmergencyContact,
  Paginated,
  SOSActions,
  SOSConfig,
  SOSEvent,
} from './types';

export type ContactPayload = {
  name: string;
  phone_number: string;
  relationship?: string;
  is_primary?: boolean;
};

export const contactsApi = {
  async list(): Promise<EmergencyContact[]> {
    const { data } = await api.get<Paginated<EmergencyContact>>('/sos/contacts/');
    return data.results;
  },

  async create(payload: ContactPayload): Promise<EmergencyContact> {
    const { data } = await api.post<EmergencyContact>('/sos/contacts/', payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/sos/contacts/${id}/`);
  },

  async setPrimary(id: string): Promise<EmergencyContact> {
    const { data } = await api.post<EmergencyContact>(`/sos/contacts/${id}/set_primary/`);
    return data;
  },
};

export const sosConfigApi = {
  async get(): Promise<SOSConfig> {
    const { data } = await api.get<SOSConfig>('/sos/config/');
    return data;
  },

  async update(payload: Partial<SOSConfig>): Promise<SOSConfig> {
    const { data } = await api.patch<SOSConfig>('/sos/config/', payload);
    return data;
  },
};

export const sosApi = {
  async trigger(params: {
    ride_id?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<{ event: SOSEvent; actions: SOSActions }> {
    const { data } = await api.post('/sos/trigger/', params);
    return data;
  },
};
