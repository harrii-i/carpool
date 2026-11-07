import { create } from 'zustand';

import { authApi } from '@/api/auth';
import { clearTokens, getRefresh, loadTokens, setTokens } from '@/api/tokenStore';
import { CurrentUser, TokenPair } from '@/api/types';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

type AuthState = {
  status: AuthStatus;
  user: CurrentUser | null;
  /** Load persisted tokens on launch and fetch the current user. */
  hydrate: () => Promise<void>;
  /** Persist tokens (from login/verify) and load the user. */
  authenticate: (tokens: TokenPair) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,

  hydrate: async () => {
    const hasTokens = await loadTokens();
    if (!hasTokens) {
      set({ status: 'anonymous', user: null });
      return;
    }
    try {
      const user = await authApi.me();
      set({ status: 'authenticated', user });
    } catch {
      await clearTokens();
      set({ status: 'anonymous', user: null });
    }
  },

  authenticate: async (tokens) => {
    await setTokens(tokens);
    const user = await authApi.me();
    set({ status: 'authenticated', user });
  },

  refreshUser: async () => {
    const user = await authApi.me();
    set({ user });
  },

  logout: async () => {
    const refresh = getRefresh();
    if (refresh) {
      try {
        await authApi.logout(refresh);
      } catch {
        // Ignore network/expiry errors on logout; we clear locally regardless.
      }
    }
    await clearTokens();
    set({ status: 'anonymous', user: null });
  },
}));
