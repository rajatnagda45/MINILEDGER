import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { configureApi } from '@/lib/api';
import { tokenStorage } from '@/lib/storage';
import { createTestClient, TestQueryProvider } from './test-utils';

jest.mock('@/lib/api', () => ({
  api: { verifyOtp: jest.fn() },
  configureApi: jest.fn(),
}));
jest.mock('@/lib/storage', () => ({ tokenStorage: { get: jest.fn(), set: jest.fn(), clear: jest.fn() } }));

function Probe() {
  const auth = useAuth();
  const [, renderAgain] = useState(0);
  return <>
    <Text>{auth.isRestoring ? 'restoring' : auth.token ?? 'signed-out'}</Text>
    <Pressable accessibilityRole="button" onPress={() => void auth.signOut()}><Text>Sign out now</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => renderAgain((value) => value + 1)}><Text>Render</Text></Pressable>
  </>;
}

beforeEach(() => jest.clearAllMocks());

it('restores a saved session, then clears token storage and query data on logout', async () => {
  (tokenStorage.get as jest.Mock).mockResolvedValue('saved-token');
  (tokenStorage.clear as jest.Mock).mockResolvedValue(undefined);
  const client = createTestClient();
  client.setQueryData(['loans'], { loans: [{ id: 'cached' }] });
  const clear = jest.spyOn(client, 'clear');
  await render(<TestQueryProvider client={client}><AuthProvider><Probe /></AuthProvider></TestQueryProvider>);

  expect(await screen.findByText('saved-token')).toBeTruthy();
  expect(configureApi).toHaveBeenCalledWith('saved-token', expect.any(Function));
  await fireEvent.press(screen.getByText('Sign out now'));

  await waitFor(() => expect(screen.getByText('signed-out')).toBeTruthy());
  expect(tokenStorage.clear).toHaveBeenCalledTimes(1);
  expect(clear).toHaveBeenCalledTimes(1);
  expect(configureApi).toHaveBeenLastCalledWith(null);
});

it('uses the same full cleanup path when the API reports an expired session', async () => {
  (tokenStorage.get as jest.Mock).mockResolvedValue('expired-token');
  (tokenStorage.clear as jest.Mock).mockResolvedValue(undefined);
  await render(<TestQueryProvider><AuthProvider><Probe /></AuthProvider></TestQueryProvider>);
  await screen.findByText('expired-token');
  const unauthorized = (configureApi as jest.Mock).mock.calls.at(-1)?.[1] as () => void;
  await act(() => unauthorized());
  expect(await screen.findByText('signed-out')).toBeTruthy();
  expect(tokenStorage.clear).toHaveBeenCalledTimes(1);
});
