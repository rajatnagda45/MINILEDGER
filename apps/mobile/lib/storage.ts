import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'miniledger.session-token';

function webStorage(): Storage {
  const runtime = globalThis as typeof globalThis & { window?: Window; localStorage?: Storage };
  try {
    const storage = runtime.window?.localStorage ?? runtime.localStorage;
    if (!storage) throw new Error('Browser storage is unavailable.');
    return storage;
  } catch {
    throw new Error('Browser storage is unavailable. Check your privacy settings and try again.');
  }
}

export const tokenStorage = {
  async get(): Promise<string | null> {
    if (Platform.OS === 'web') return webStorage().getItem(TOKEN_KEY);
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  async set(token: string): Promise<void> {
    if (Platform.OS === 'web') webStorage().setItem(TOKEN_KEY, token);
    else await SecureStore.setItemAsync(TOKEN_KEY, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
  async clear(): Promise<void> {
    if (Platform.OS === 'web') webStorage().removeItem(TOKEN_KEY);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};

