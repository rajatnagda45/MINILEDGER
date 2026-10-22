import { act, fireEvent, render, waitFor, type RenderResult } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import type { Loan } from '@miniledger/shared';
import AddLoanScreen from '@/app/(app)/add-loan';
import { api, ApiError } from '@/lib/api';
import { createTestClient, TestQueryProvider } from './test-utils';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn() }, useNavigation: () => ({ dispatch: jest.fn() }) }));
jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn() }));
jest.mock('@/components/fade-in-view', () => {
  const { View } = jest.requireActual('react-native');
  return { FadeInView: ({ children, style }: { children: React.ReactNode; style?: object }) => <View style={style}>{children}</View> };
});
jest.mock('@/components/receipt-picker', () => ({ ReceiptPicker: () => null }));
jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return { ...actual, api: { ...actual.api, createLoan: jest.fn(), uploadReceipt: jest.fn() } };
});

const createLoan = api.createLoan as jest.MockedFunction<typeof api.createLoan>;
const originalOS = Platform.OS;
const created: Loan = {
  id: 'loan-new', friendName: 'Riya Shah', amount: 1250.5, currency: 'INR', dueDate: '2026-11-01',
  status: 'OUTSTANDING', isOverdue: false, receiptAvailable: false, receipt: null,
  createdAt: '2026-10-23T00:00:00.000Z', updatedAt: '2026-10-23T00:00:00.000Z', repaidAt: null,
};

beforeAll(() => Object.defineProperty(Platform, 'OS', { value: 'web' }));
afterAll(() => Object.defineProperty(Platform, 'OS', { value: originalOS }));
beforeEach(() => jest.clearAllMocks());

async function fillValid(screen: RenderResult) {
  await fireEvent.changeText(screen.getByLabelText('Friend’s name'), 'Riya Shah');
  await fireEvent.changeText(screen.getByLabelText('Amount lent'), '1250.50');
  await fireEvent.changeText(screen.getByLabelText('Due date'), '2026-11-01');
}

it('rejects invalid amount and date before calling the server', async () => {
  const screen = await render(<AddLoanScreen />, { wrapper: TestQueryProvider });
  await fireEvent.changeText(screen.getByLabelText('Friend’s name'), 'Riya Shah');
  await fireEvent.changeText(screen.getByLabelText('Amount lent'), '0');
  await fireEvent.changeText(screen.getByLabelText('Due date'), '2026-02-30');
  await fireEvent.press(screen.getByText('Add loan'));

  expect(await screen.findByText('Amount must be greater than zero.')).toBeTruthy();
  expect(screen.getByText('Choose a valid due date.')).toBeTruthy();
  expect(createLoan).not.toHaveBeenCalled();
});

it('surfaces server errors, clears loading, and does not navigate', async () => {
  let fail!: (error: Error) => void;
  createLoan.mockReturnValue(new Promise((_resolve, reject) => { fail = reject; }));
  const screen = await render(<AddLoanScreen />, { wrapper: TestQueryProvider });
  await fillValid(screen);
  await fireEvent.press(screen.getByText('Add loan'));

  const saving = await screen.findByLabelText('Saving loan…');
  expect(saving).toBeDisabled();
  expect(saving.props.accessibilityState.busy).toBe(true);
  await act(async () => { fail(new ApiError(422, 'VALIDATION_ERROR', 'The due date is invalid.')); });

  expect(await screen.findByText('The due date is invalid.')).toBeTruthy();
  expect(screen.getByLabelText('Add loan')).not.toBeDisabled();
  expect(screen.queryByText('Saving loan…')).toBeNull();
  expect(router.replace).not.toHaveBeenCalled();
});

it('creates only once, shows an accessible success state, and offers clear next actions', async () => {
  let complete!: (value: { loan: Loan }) => void;
  createLoan.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
  const client = createTestClient();
  const invalidate = jest.spyOn(client, 'invalidateQueries').mockResolvedValue();
  const screen = await render(<TestQueryProvider client={client}><AddLoanScreen /></TestQueryProvider>);
  await fillValid(screen);
  await fireEvent.press(screen.getByText('Add loan'));
  const saving = await screen.findByLabelText('Saving loan…');
  expect(saving).toBeDisabled();
  await fireEvent.press(saving);

  expect(createLoan).toHaveBeenCalledTimes(1);
  await act(async () => { complete({ loan: created }); });
  const success = await screen.findByRole('alert');
  expect(success.props.accessibilityLiveRegion).toBe('polite');
  expect(await screen.findByRole('status', { name: /Loan added.*Riya Shah now appears in your ledger/i })).toBeTruthy();
  expect(screen.getAllByText('Loan added')).toHaveLength(2);
  expect(screen.getAllByText('Riya Shah now appears in your ledger.')).toHaveLength(2);
  expect(screen.queryByText('Saving loan…')).toBeNull();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['loans'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['summary'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['loan', 'loan-new'] });

  await fireEvent.press(screen.getByText('View loan'));
  expect(router.replace).toHaveBeenCalledWith({ pathname: '/(app)/loan/[id]', params: { id: 'loan-new' } });
  await fireEvent.press(screen.getByText('Back to dashboard'));
  expect(router.replace).toHaveBeenCalledWith('/(app)');
});
