/**
 * In-memory + persisted JWT token cache.
 *
 * Kept separate from React state so the axios interceptors can read/refresh
 * tokens synchronously without touching the component tree.
 */
import { deleteItem, getItem, setItem } from '@/lib/secureStore';

const ACCESS_KEY = 'carpool.access';
const REFRESH_KEY = 'carpool.refresh';

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function getAccess(): string | null {
  return accessToken;
}

export function getRefresh(): string | null {
  return refreshToken;
}

export async function loadTokens(): Promise<boolean> {
  accessToken = await getItem(ACCESS_KEY);
  refreshToken = await getItem(REFRESH_KEY);
  return !!accessToken && !!refreshToken;
}

export async function setTokens(tokens: { access: string; refresh?: string }): Promise<void> {
  accessToken = tokens.access;
  await setItem(ACCESS_KEY, tokens.access);
  if (tokens.refresh) {
    refreshToken = tokens.refresh;
    await setItem(REFRESH_KEY, tokens.refresh);
  }
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  await Promise.all([deleteItem(ACCESS_KEY), deleteItem(REFRESH_KEY)]);
}
