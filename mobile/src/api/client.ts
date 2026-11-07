/**
 * Axios API client with automatic JWT refresh (§8).
 *
 * - Requests attach the current access token.
 * - On a 401, the client transparently refreshes once using the refresh token
 *   and retries the original request. Concurrent 401s share a single refresh.
 * - If refresh fails, tokens are cleared and an `onAuthExpired` callback fires
 *   so the app can route back to login.
 */
import axios, {
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';

import { config } from '@/config';
import { clearTokens, getAccess, getRefresh, setTokens } from './tokenStore';

export type ApiError = {
  code: string;
  message: string;
  detail?: unknown;
};

let onAuthExpired: (() => void) | null = null;
export function setOnAuthExpired(cb: () => void) {
  onAuthExpired = cb;
}

export const api = axios.create({
  baseURL: config.apiBase,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  const token = getAccess();
  if (token && cfg.headers) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

// --- single-flight refresh handling ---
let refreshing: Promise<string | null> | null = null;

async function refreshAccess(): Promise<string | null> {
  const refresh = getRefresh();
  if (!refresh) return null;
  try {
    const resp = await axios.post(`${config.apiBase}/auth/refresh/`, { refresh });
    const access = resp.data?.access as string | undefined;
    const newRefresh = resp.data?.refresh as string | undefined;
    if (!access) return null;
    await setTokens({ access, refresh: newRefresh });
    return access;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;

    if (status === 401 && original && !original._retry && getRefresh()) {
      original._retry = true;
      refreshing = refreshing ?? refreshAccess();
      const newAccess = await refreshing;
      refreshing = null;

      if (newAccess) {
        original.headers = { ...original.headers, Authorization: `Bearer ${newAccess}` };
        return api(original);
      }
      await clearTokens();
      onAuthExpired?.();
    }
    return Promise.reject(error);
  },
);

/** Normalise the backend's error envelope into a predictable shape. */
export function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: ApiError } | undefined;
    if (data?.error) return data.error;
    if (error.code === 'ECONNABORTED') {
      return { code: 'timeout', message: 'The request timed out. Check your connection.' };
    }
    if (!error.response) {
      return { code: 'network', message: 'Network error. Check your connection.' };
    }
    return { code: 'error', message: error.message };
  }
  return { code: 'unknown', message: 'Something went wrong.' };
}
