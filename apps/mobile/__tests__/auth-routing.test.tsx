import { fireEvent, render } from '@testing-library/react-native';
import AppLayout from '@/app/(app)/_layout';
import AuthLayout from '@/app/(auth)/_layout';
import IndexScreen from '@/app/index';

let mockAuthState = {
  token: null as string | null,
  isRestoring: false,
  restoreError: null as string | null,
  retryRestore: jest.fn(),
};

jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuthState }));
jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  const { Text: MockText } = jest.requireActual('react-native');
  const MockStack = () => React.createElement(MockText, null, 'route-stack');
  MockStack.Screen = () => null;
  return {
    Redirect: ({ href }: { href: string }) => React.createElement(MockText, null, `redirect:${href}`),
    Stack: MockStack,
  };
});

beforeEach(() => {
  mockAuthState = { token: null, isRestoring: false, restoreError: null, retryRestore: jest.fn() };
});

it('does not redirect a protected route before restoration completes', async () => {
  mockAuthState = { ...mockAuthState, isRestoring: true };
  const screen = await render(<AppLayout />);
  expect(screen.getByText('Restoring your secure session…')).toBeTruthy();
  expect(screen.queryByText(/redirect:/)).toBeNull();
  expect(screen.queryByText('route-stack')).toBeNull();
});

it('keeps a network restoration failure behind a recoverable gate', async () => {
  mockAuthState = { ...mockAuthState, token: 'saved-token', restoreError: 'Connection unavailable.' };
  const screen = await render(<AppLayout />);
  expect(screen.getByText('Couldn’t verify your session')).toBeTruthy();
  expect(screen.getByText('Stored credentials are cleared only when the server rejects the session.')).toBeTruthy();
  expect(screen.queryByText(/redirect:/)).toBeNull();
  await fireEvent.press(screen.getByText('Try again'));
  expect(mockAuthState.retryRestore).toHaveBeenCalledTimes(1);
});

it('keeps protected routes inaccessible without authentication', async () => {
  const screen = await render(<AppLayout />);
  expect(screen.getByText('redirect:/(auth)/login')).toBeTruthy();
  expect(screen.queryByText('route-stack')).toBeNull();
});

it('renders protected content only for a restored valid session', async () => {
  mockAuthState = { ...mockAuthState, token: 'valid-token' };
  const screen = await render(<AppLayout />);
  expect(screen.getByText('route-stack')).toBeTruthy();
  expect(screen.queryByText(/redirect:/)).toBeNull();
});

it('routes authenticated and anonymous root/auth states without a redirect loop', async () => {
  const anonymousAuth = await render(<AuthLayout />);
  expect(anonymousAuth.getByText('route-stack')).toBeTruthy();
  await anonymousAuth.unmount();

  mockAuthState = { ...mockAuthState, token: 'valid-token' };
  const authenticatedAuth = await render(<AuthLayout />);
  expect(authenticatedAuth.getByText('redirect:/(app)')).toBeTruthy();
  await authenticatedAuth.unmount();

  const authenticatedRoot = await render(<IndexScreen />);
  expect(authenticatedRoot.getByText('redirect:/(app)')).toBeTruthy();
});
