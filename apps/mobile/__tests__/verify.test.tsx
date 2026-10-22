import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import VerifyScreen from '@/app/(auth)/verify';
import { api, ApiError } from '@/lib/api';
import { TestQueryProvider } from './test-utils';

const mockSignIn = jest.fn();
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ phone: '+919876543210', resend: '0' }),
}));
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ signIn: mockSignIn }) }));
jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return { ...actual, api: { ...actual.api, sendOtp: jest.fn() } };
});

const sendOtp = api.sendOtp as jest.MockedFunction<typeof api.sendOtp>;

beforeEach(() => jest.clearAllMocks());

async function flushQueryNotifications() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

it('keeps verification disabled until six digits are entered', async () => {
  const screen = await render(<VerifyScreen />, { wrapper: TestQueryProvider });
  const button = screen.getByLabelText('Verify & open ledger');
  expect(button).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Six-digit verification code'), '12345');
  await fireEvent.press(button);
  expect(mockSignIn).not.toHaveBeenCalled();
});

it('submits pasted digits once and exposes an OTP API error', async () => {
  let fail!: (error: Error) => void;
  mockSignIn.mockReturnValue(new Promise((_resolve, reject) => { fail = reject; }));
  const screen = await render(<VerifyScreen />, { wrapper: TestQueryProvider });
  await fireEvent.changeText(screen.getByLabelText('Six-digit verification code'), '12a3456');
  const button = screen.getByText('Verify & open ledger');
  await fireEvent.press(button);
  await fireEvent.press(button);

  expect(mockSignIn).toHaveBeenCalledTimes(1);
  expect(mockSignIn).toHaveBeenCalledWith('+919876543210', '123456');
  await act(async () => {
    fail(new ApiError(401, 'OTP_INVALID', 'That code is incorrect.'));
  });
  expect(await screen.findByText('That code is incorrect.')).toBeTruthy();
  await waitFor(() => expect(screen.getByLabelText('Verify & open ledger')).not.toBeDisabled());
  await flushQueryNotifications();
});

it('completes successful OTP authentication without showing an error', async () => {
  mockSignIn.mockResolvedValue(undefined);
  const screen = await render(<VerifyScreen />, { wrapper: TestQueryProvider });
  await fireEvent.changeText(screen.getByLabelText('Six-digit verification code'), '654321');
  await fireEvent.press(screen.getByText('Verify & open ledger'));
  await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith('+919876543210', '654321'));
  await waitFor(() => expect(screen.getByLabelText('Verify & open ledger')).not.toBeDisabled());
  await flushQueryNotifications();
  expect(screen.queryByText('That code is incorrect.')).toBeNull();
});

it('prevents duplicate resend requests and restores the action after failure', async () => {
  let fail!: (error: Error) => void;
  sendOtp.mockReturnValue(new Promise((_resolve, reject) => { fail = reject; }));
  const screen = await render(<VerifyScreen />, { wrapper: TestQueryProvider });
  const resend = screen.getByLabelText('Resend code');
  await fireEvent.press(resend);
  await fireEvent.press(resend);
  expect(sendOtp).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.getByLabelText('Sending code…')).toBeDisabled());

  await act(async () => { fail(new ApiError(503, 'UNAVAILABLE', 'Please try again.')); });
  expect(await screen.findByText('Please try again.')).toBeTruthy();
  expect(screen.getByLabelText('Resend code')).not.toBeDisabled();
});
