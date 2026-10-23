import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { tokenStorage } from '@/lib/storage';

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const originalOS = Platform.OS;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { value: originalOS });
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete (globalThis as { localStorage?: Storage }).localStorage;
  jest.clearAllMocks();
});

it('uses browser-local storage on web without sending the token elsewhere', async () => {
  Object.defineProperty(Platform, 'OS', { value: 'web' });
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  await tokenStorage.set('web-token');
  expect(await tokenStorage.get()).toBe('web-token');
  await tokenStorage.clear();
  expect(await tokenStorage.get()).toBeNull();
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});

it('does not silently pretend to persist when browser storage is unavailable', async () => {
  Object.defineProperty(Platform, 'OS', { value: 'web' });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined });

  await expect(tokenStorage.set('web-token')).rejects.toThrow('Browser storage is unavailable');
  await expect(tokenStorage.get()).rejects.toThrow('Browser storage is unavailable');
});

it('uses device-only SecureStore accessibility on native', async () => {
  Object.defineProperty(Platform, 'OS', { value: 'ios' });
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('native-token');
  await tokenStorage.set('native-token');
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    'miniledger.session-token',
    'native-token',
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
  );
  expect(await tokenStorage.get()).toBe('native-token');
  await tokenStorage.clear();
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('miniledger.session-token');
});
