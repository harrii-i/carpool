import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Secure token storage. Uses the device keychain/keystore via expo-secure-store
 * (§8, §43). On web (where SecureStore is unavailable) it falls back to
 * localStorage so `expo start --web` still works during development.
 */
const memoryFallback = new Map<string, string>();

async function webGet(key: string) {
  try {
    return globalThis.localStorage?.getItem(key) ?? memoryFallback.get(key) ?? null;
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return webGet(key);
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      memoryFallback.set(key, value);
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      memoryFallback.delete(key);
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
