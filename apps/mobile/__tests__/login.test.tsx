import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import LoginScreen from '@/app/(auth)/login';
import { api, ApiError } from '@/lib/api';
import { TestQueryProvider } from './test-utils';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/hooks/use-responsive', () => ({ useResponsive: () => ({ width: 390, isTablet: false, isDesktop: false, isWide: false }) }));
jest.mock('@/components/fade-in-view', () => {
  const { View } = jest.requireActual('react-native');
  return { FadeInView: ({ children, style }: { children: React.ReactNode; style?: object }) => <View style={style}>{children}</View> };
});
jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return { ...actual, api: { ...actual.api, sendOtp: jest.fn() } };
});

const sendOtp = api.sendOtp as jest.MockedFunction<typeof api.sendOtp>;

beforeEach(() => jest.clearAllMocks());

it('shows validation without calling the API for an invalid mobile number', async () => {
  const screen = await render(<LoginScreen />, { wrapper: TestQueryProvider });
  await fireEvent.changeText(screen.getByLabelText('Mobile number'), '123');
  await fireEvent.press(screen.getByText('Continue securely'));
  expect(await screen.findByText('Enter a valid 10-digit Indian mobile number.')).toBeTruthy();
  expect(sendOtp).not.toHaveBeenCalled();
});

it('submits the normalized number once and navigates to OTP verification', async () => {
  let complete!: (value: { phoneNumber: string; expiresInSeconds: number; resendInSeconds: number }) => void;
  sendOtp.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
  const screen = await render(<LoginScreen />, { wrapper: TestQueryProvider });
  await fireEvent.changeText(screen.getByLabelText('Mobile number'), '98765 43210');
  const submit = screen.getByText('Continue securely');
  await fireEvent.press(submit);
  await waitFor(() => expect(screen.getByLabelText('Sending code…')).toBeDisabled());
  await fireEvent.press(submit);

  expect(sendOtp).toHaveBeenCalledTimes(1);
  await act(() => complete({ phoneNumber: '+919876543210', expiresInSeconds: 300, resendInSeconds: 30 }));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith({
    pathname: '/(auth)/verify', params: { phone: '+919876543210', resend: '30' },
  }));
});

it('renders the API error instead of looking successful', async () => {
  sendOtp.mockRejectedValue(new ApiError(429, 'OTP_COOLDOWN', 'Please wait before requesting another code.'));
  const screen = await render(<LoginScreen />, { wrapper: TestQueryProvider });
  await fireEvent.changeText(screen.getByLabelText('Mobile number'), '9876543210');
  await fireEvent.press(screen.getByText('Continue securely'));
  expect(await screen.findByText('Please wait before requesting another code.')).toBeTruthy();
  expect(router.push).not.toHaveBeenCalled();
});
