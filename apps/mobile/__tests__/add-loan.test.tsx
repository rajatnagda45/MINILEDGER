import { act, fireEvent, render, waitFor, type RenderResult } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import type { Loan } from '@miniledger/shared';
import AddLoanScreen from '@/app/(app)/add-loan';
import { api, ApiError } from '@/lib/api';
import { notify } from '@/lib/confirm';
import { createTestClient, TestQueryProvider } from './test-utils';

jest.mock('expo-router', () => ({ router: { back: jest.fn() }, useNavigation: () => ({ dispatch: jest.fn() }) }));
jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn() }));
jest.mock('@/components/fade-in-view', () => {
  const { View } = jest.requireActual('react-native');
  return { FadeInView: ({ children, style }: { children: React.ReactNode; style?: object }) => <View style={style}>{children}</View> };
});
jest.mock('@/components/receipt-picker', () => ({ ReceiptPicker: () => null }));
jest.mock('@/lib/confirm', () => ({ confirmAction: jest.fn(), notify: jest.fn() }));
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
  await fireEvent.press(screen.getByText('Add to my ledger'));

  expect(await screen.findByText('Amount must be greater than zero.')).toBeTruthy();
  expect(screen.getByText('Choose a valid due date.')).toBeTruthy();
  expect(createLoan).not.toHaveBeenCalled();
});

it('surfaces server validation errors and does not navigate', async () => {
  createLoan.mockRejectedValue(new ApiError(422, 'VALIDATION_ERROR', 'The due date is invalid.'));
  const screen = await render(<AddLoanScreen />, { wrapper: TestQueryProvider });
  await fillValid(screen);
  await fireEvent.press(screen.getByText('Add to my ledger'));

  expect(await screen.findByText('The due date is invalid.')).toBeTruthy();
  expect(notify).not.toHaveBeenCalled();
  expect(router.back).not.toHaveBeenCalled();
});

it('creates only once, refreshes all affected queries, and navigates after acknowledgement', async () => {
  let complete!: (value: { loan: Loan }) => void;
  createLoan.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
  const client = createTestClient();
  const invalidate = jest.spyOn(client, 'invalidateQueries').mockResolvedValue();
  const screen = await render(<TestQueryProvider client={client}><AddLoanScreen /></TestQueryProvider>);
  await fillValid(screen);
  const submit = screen.getByText('Add to my ledger');
  await fireEvent.press(submit);
  await waitFor(() => expect(screen.getByLabelText('Add to my ledger')).toBeDisabled());
  await fireEvent.press(submit);

  expect(createLoan).toHaveBeenCalledTimes(1);
  await act(() => complete({ loan: created }));
  await waitFor(() => expect(notify).toHaveBeenCalledWith('Loan added', 'Riya Shah now appears in your ledger.', expect.any(Function)));
  await waitFor(() => expect(screen.getByLabelText('Add to my ledger')).not.toBeDisabled());
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['loans'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['summary'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['loan', 'loan-new'] });
  const acknowledge = (notify as jest.Mock).mock.calls[0][2] as () => void;
  acknowledge();
  expect(router.back).toHaveBeenCalledTimes(1);
});
