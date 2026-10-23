import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { Loan, ReceiptMeta } from '@miniledger/shared';
import LoanDetailScreen from '@/app/(app)/loan/[id]';
import { api, ApiError } from '@/lib/api';
import { createTestClient, TestQueryProvider } from './test-utils';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: jest.fn(() => false), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: 'loan-detail-1' }),
}));
jest.mock('@/hooks/use-responsive', () => ({ useResponsive: () => ({ width: 390, isTablet: false, isDesktop: false, isWide: false }) }));
jest.mock('@/components/receipt-section', () => {
  const { Text: MockText } = jest.requireActual('react-native');
  return {
    ReceiptSection: ({ loanId, receipt }: { loanId: string; receipt: ReceiptMeta | null }) => (
      <MockText>{receipt ? `Receipt ${loanId}: ${receipt.mimeType}, ${receipt.byteSize} bytes` : `No receipt for ${loanId}`}</MockText>
    ),
  };
});
jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return { ...actual, api: { ...actual.api, loan: jest.fn(), repayLoan: jest.fn() } };
});

const getLoan = api.loan as jest.MockedFunction<typeof api.loan>;
const repayLoan = api.repayLoan as jest.MockedFunction<typeof api.repayLoan>;
const receipt: ReceiptMeta = { mimeType: 'image/png', byteSize: 4096, createdAt: '2026-10-20T00:00:00.000Z' };
const activeLoan: Loan = {
  id: 'loan-detail-1',
  friendName: 'A very long friend name returned by the server',
  amount: 10_000_000,
  currency: 'INR',
  dueDate: '2026-10-21',
  status: 'OUTSTANDING',
  isOverdue: true,
  receiptAvailable: true,
  receipt,
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
  repaidAt: null,
};

beforeEach(() => jest.clearAllMocks());

it('renders the requested API-backed loan and receipt metadata without substitute values', async () => {
  getLoan.mockResolvedValue({ loan: activeLoan });
  const screen = await render(<LoanDetailScreen />, { wrapper: TestQueryProvider });

  expect(await screen.findByText(activeLoan.friendName)).toBeTruthy();
  expect(screen.getByText('₹1,00,00,000')).toBeTruthy();
  expect(screen.getByText('21 Oct 2026')).toBeTruthy();
  expect(screen.getByText('20 Oct 2026')).toBeTruthy();
  expect(screen.getByLabelText('Payment overdue')).toBeTruthy();
  expect(screen.getByText('Receipt loan-detail-1: image/png, 4096 bytes')).toBeTruthy();
  expect(screen.queryByText('Repaid on')).toBeNull();
});

it('shows a genuine error state instead of fabricated loan details', async () => {
  getLoan.mockRejectedValue(new ApiError(404, 'LOAN_NOT_FOUND', 'Loan not found.'));
  const screen = await render(<LoanDetailScreen />, { wrapper: TestQueryProvider });

  expect(await screen.findByText('Loan not found.')).toBeTruthy();
  expect(screen.queryByText('₹0')).toBeNull();
  expect(screen.queryByText('Payment outstanding')).toBeNull();
});

it('changes repayment UI only after server success and refreshes every affected query', async () => {
  const settled: Loan = { ...activeLoan, status: 'REPAID', isOverdue: false, repaidAt: '2026-10-23T00:00:00.000Z' };
  getLoan.mockResolvedValueOnce({ loan: activeLoan }).mockResolvedValue({ loan: settled });
  let finishRepayment!: (value: { loan: Loan }) => void;
  repayLoan.mockReturnValue(new Promise((resolve) => { finishRepayment = resolve; }));
  const client = createTestClient();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const screen = await render(<TestQueryProvider client={client}><LoanDetailScreen /></TestQueryProvider>);

  await fireEvent.press(await screen.findByLabelText('Mark as repaid'));
  await fireEvent.press(screen.getByLabelText('Yes, mark repaid'));
  expect(repayLoan).toHaveBeenCalledTimes(1);
  expect(screen.getAllByLabelText('Marking as repaid…')).toHaveLength(2);
  screen.getAllByLabelText('Marking as repaid…').forEach((action) => expect(action).toBeDisabled());
  expect(screen.queryByText('This loan is settled')).toBeNull();

  await act(async () => { finishRepayment({ loan: settled }); });
  expect(await screen.findByText('Repayment recorded')).toBeTruthy();
  await waitFor(() => expect(screen.getByText('This loan is settled')).toBeTruthy());
  expect(screen.getByText('Repaid on')).toBeTruthy();
  expect(screen.getByText('23 Oct 2026')).toBeTruthy();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['loan', 'loan-detail-1'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['loans'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['summary'] });
});

it('keeps the outstanding action retryable when repayment fails', async () => {
  getLoan.mockResolvedValue({ loan: activeLoan });
  repayLoan.mockRejectedValue(new ApiError(409, 'LOAN_ALREADY_REPAID', 'This loan was already repaid.'));
  const screen = await render(<LoanDetailScreen />, { wrapper: TestQueryProvider });

  await fireEvent.press(await screen.findByLabelText('Mark as repaid'));
  await fireEvent.press(screen.getByLabelText('Yes, mark repaid'));

  expect(await screen.findByText('Couldn’t update loan')).toBeTruthy();
  expect(screen.getByText('This loan was already repaid.')).toBeTruthy();
  expect(screen.getByText('Confirm repayment')).toBeTruthy();
  expect(screen.getByLabelText('Yes, mark repaid')).not.toBeDisabled();
  expect(screen.getByLabelText('Mark as repaid')).not.toBeDisabled();
  expect(screen.queryByText('This loan is settled')).toBeNull();
});
