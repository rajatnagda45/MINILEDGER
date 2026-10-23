import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { api, ApiError, configureApi } from '@/lib/api';
import { tokenStorage } from '@/lib/storage';
import { createTestClient, TestQueryProvider } from './test-utils';

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return { ...actual, api: { ...actual.api, verifyOtp: jest.fn(), validateSession: jest.fn() }, configureApi: jest.fn() };
});
jest.mock('@/lib/storage', () => ({ tokenStorage: { get: jest.fn(), set: jest.fn(), clear: jest.fn() } }));

const validateSession = api.validateSession as jest.MockedFunction<typeof api.validateSession>;
const verifyOtp = api.verifyOtp as jest.MockedFunction<typeof api.verifyOtp>;

function Probe() {
  const auth = useAuth();
  const [, renderAgain] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  return <>
    <Text>{auth.isRestoring ? 'restoring' : auth.restoreError ? `restore-error: ${auth.restoreError}` : auth.token ?? 'signed-out'}</Text>
    {!!actionError && <Text>{actionError}</Text>}
    <Pressable accessibilityRole="button" onPress={() => auth.retryRestore()}><Text>Retry restoration</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => void auth.signIn('+919876543210', '123456')}><Text>Sign in now</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => { void auth.signOut().catch((error: Error) => setActionError(error.message)); }}><Text>Sign out now</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => renderAgain((value) => value + 1)}><Text>Render</Text></Pressable>
  </>;
}

beforeEach(() => {
  jest.clearAllMocks();
  (tokenStorage.clear as jest.Mock).mockResolvedValue(undefined);
  (tokenStorage.set as jest.Mock).mockResolvedValue(undefined);
});

it('waits for validation, restores a saved session, then clears storage and query data on logout', async () => {
  (tokenStorage.get as jest.Mock).mockResolvedValue('saved-token');
  let finishValidation!: () => void;
  validateSession.mockReturnValue(new Promise<void>((resolve) => { finishValidation = resolve; }));
  const client = createTestClient();
  client.setQueryData(['loans'], { loans: [{ id: 'cached' }] });
  const clear = jest.spyOn(client, 'clear');
  await render(<TestQueryProvider client={client}><AuthProvider><Probe /></AuthProvider></TestQueryProvider>);

  expect(screen.getByText('restoring')).toBeTruthy();
  await waitFor(() => expect(validateSession).toHaveBeenCalledTimes(1));
  expect(screen.getByText('restoring')).toBeTruthy();
  expect(configureApi).toHaveBeenCalledWith('saved-token');
  await act(async () => finishValidation());
  expect(await screen.findByText('saved-token')).toBeTruthy();
  expect(configureApi).toHaveBeenCalledWith('saved-token', expect.any(Function));
  await fireEvent.press(screen.getByText('Sign out now'));

  await waitFor(() => expect(screen.getByText('signed-out')).toBeTruthy());
  expect(tokenStorage.clear).toHaveBeenCalledTimes(1);
  expect(clear).toHaveBeenCalledTimes(1);
  expect(configureApi).toHaveBeenLastCalledWith(null);
});

it('clears an invalid or expired persisted session', async () => {
  (tokenStorage.get as jest.Mock).mockResolvedValue('expired-token');
  validateSession.mockRejectedValue(new ApiError(401, 'SESSION_EXPIRED', 'Sign in again.'));
  await render(<TestQueryProvider><AuthProvider><Probe /></AuthProvider></TestQueryProvider>);
  expect(await screen.findByText('signed-out')).toBeTruthy();
  expect(tokenStorage.clear).toHaveBeenCalledTimes(1);
  expect(configureApi).toHaveBeenLastCalledWith(null);
});

it('keeps a potentially valid token on network failure and can retry restoration', async () => {
  (tokenStorage.get as jest.Mock).mockResolvedValue('saved-token');
  validateSession.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'Connection unavailable.')).mockResolvedValueOnce(undefined);
  await render(<TestQueryProvider><AuthProvider><Probe /></AuthProvider></TestQueryProvider>);

  expect(await screen.findByText('restore-error: Connection unavailable.')).toBeTruthy();
  expect(tokenStorage.clear).not.toHaveBeenCalled();
  expect(configureApi).toHaveBeenCalledWith('saved-token', expect.any(Function));
  await fireEvent.press(screen.getByText('Retry restoration'));
  expect(await screen.findByText('saved-token')).toBeTruthy();
  expect(validateSession).toHaveBeenCalledTimes(2);
});

it('persists a successful OTP session before publishing it as authenticated', async () => {
  (tokenStorage.get as jest.Mock).mockResolvedValue(null);
  verifyOtp.mockResolvedValue({ token: 'fresh-token', user: { id: 'user-1', phoneNumber: '+919876543210' } });
  await render(<TestQueryProvider><AuthProvider><Probe /></AuthProvider></TestQueryProvider>);
  await screen.findByText('signed-out');

  await fireEvent.press(screen.getByText('Sign in now'));
  expect(await screen.findByText('fresh-token')).toBeTruthy();
  expect(tokenStorage.set).toHaveBeenCalledWith('fresh-token');
  expect(configureApi).toHaveBeenLastCalledWith('fresh-token', expect.any(Function));
});

it('blocks protected UI during logout and retains the active session when secure invalidation fails', async () => {
  (tokenStorage.get as jest.Mock).mockResolvedValue('saved-token');
  validateSession.mockResolvedValue(undefined);
  let rejectClear!: (error: Error) => void;
  (tokenStorage.clear as jest.Mock).mockReturnValue(new Promise<void>((_resolve, reject) => { rejectClear = reject; }));
  const client = createTestClient();
  client.setQueryData(['loans'], { loans: [{ id: 'cached' }] });
  const clear = jest.spyOn(client, 'clear');
  await render(<TestQueryProvider client={client}><AuthProvider><Probe /></AuthProvider></TestQueryProvider>);
  await screen.findByText('saved-token');

  await fireEvent.press(screen.getByText('Sign out now'));
  expect(screen.getByText('restoring')).toBeTruthy();
  await act(async () => rejectClear(new Error('secure storage write failed')));
  expect(await screen.findByText('Couldn’t securely remove this session. Please try signing out again.')).toBeTruthy();
  expect(screen.getByText('saved-token')).toBeTruthy();
  expect(clear).not.toHaveBeenCalled();
  expect(configureApi).toHaveBeenLastCalledWith('saved-token', expect.any(Function));
});
