import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'miniledger.session-token';
// Native logout first replaces the credential with this non-token value. If
// SecureStore deletion then fails, a restart still fails closed instead of
// restoring the bearer token the user intended to remove.
const SIGNED_OUT_MARKER = 'miniledger.signed-out';
const nativeOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY } as const;

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
    const saved = await SecureStore.getItemAsync(TOKEN_KEY);
    if (saved !== SIGNED_OUT_MARKER) return saved;
    // The marker is already fail-closed. Cleanup is best-effort so a transient
    // keychain deletion error can never turn it back into an authenticated session.
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
    return null;
  },
  async set(token: string): Promise<void> {
    if (Platform.OS === 'web') webStorage().setItem(TOKEN_KEY, token);
    else await SecureStore.setItemAsync(TOKEN_KEY, token, nativeOptions);
  },
  async clear(): Promise<void> {
    if (Platform.OS === 'web') webStorage().removeItem(TOKEN_KEY);
    else {
      // Overwriting is the security boundary; deletion is storage hygiene. If
      // deletion fails, get() recognizes the marker and never returns a token.
      await SecureStore.setItemAsync(TOKEN_KEY, SIGNED_OUT_MARKER, nativeOptions);
      await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
    }
  },
};

