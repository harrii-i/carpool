/**
 * Runtime configuration.
 *
 * Set EXPO_PUBLIC_API_URL in a .env file (or the shell) to point the app at your
 * backend. On a physical device use your machine's LAN IP, not localhost, e.g.
 *   EXPO_PUBLIC_API_URL=http://192.168.1.20:8000
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export const config = {
  apiUrl: API_URL,
  apiBase: `${API_URL}/api`,
  // ws://host:port derived from the API URL.
  wsBase: API_URL.replace(/^http/, 'ws'),
} as const;
