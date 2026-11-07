import { api } from './client';
import { CurrentUser, TokenPair } from './types';

export type RegisterPayload = {
  admission_number: string;
  college_email: string;
  phone_number: string;
  password: string;
};

export const authApi = {
  async register(payload: RegisterPayload): Promise<void> {
    await api.post('/auth/register/', payload);
  },

  async verify(email: string, code: string): Promise<TokenPair> {
    const { data } = await api.post('/auth/verify/', { email, code });
    return { access: data.access, refresh: data.refresh };
  },

  async resend(email: string): Promise<void> {
    await api.post('/auth/resend/', { email });
  },

  async login(email: string, password: string): Promise<TokenPair> {
    const { data } = await api.post('/auth/login/', { email, password });
    return { access: data.access, refresh: data.refresh };
  },

  async me(): Promise<CurrentUser> {
    const { data } = await api.get('/auth/me/');
    return data;
  },

  async logout(refresh: string): Promise<void> {
    await api.post('/auth/logout/', { refresh });
  },
};
