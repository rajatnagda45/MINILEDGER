import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { Loan, Summary } from '@miniledger/shared';
import DashboardScreen from '@/app/(app)/index';
import { api, ApiError } from '@/lib/api';
import { notify } from '@/lib/confirm';
import { createTestClient, TestQueryProvider } from './test-utils';

jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const React = jest.requireActual('react');
  function MockFlatList({ data = [], renderItem, ListHeaderComponent, ListEmptyComponent, ListFooterComponent }: {
    data?: unknown[];
    renderItem: (input: { item: unknown; index: number }) => React.ReactNode;
    ListHeaderComponent?: React.ReactNode;
    ListEmptyComponent?: React.ReactNode;
    ListFooterComponent?: React.ReactNode;
  }) {
    const slot = (value: React.ReactNode) => typeof value === 'function' ? React.createElement(value) : value;
    return React.createElement('View', null,
      slot(ListHeaderComponent),
      ...data.map((item, index) => renderItem({ item, index })),
      data.length === 0 ? slot(ListEmptyComponent) : null,
      slot(ListFooterComponent),
    );
  }
  return { __esModule: true, default: MockFlatList };
});
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/hooks/use-responsive', () => ({ useResponsive: () => ({ width: 390, isTablet: false, isDesktop: false, isWide: false }) }));
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ signOut: jest.fn() }) }));
jest.mock('@/components/fade-in-view', () => {
  const { View } = jest.requireActual('react-native');
  return { FadeInView: ({ children, style }: { children: React.ReactNode; style?: object }) => <View style={style}>{children}</View> };
});
jest.mock('@/lib/confirm', () => ({
  confirmAction: jest.fn((_options, onConfirm: () => void) => onConfirm()),
  notify: jest.fn(),
}));
jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return { ...actual, api: { ...actual.api, loans: jest.fn(), summary: jest.fn(), repayLoan: jest.fn() } };
});

const loans = api.loans as jest.MockedFunction<typeof api.loans>;
const summary = api.summary as jest.MockedFunction<typeof api.summary>;
const repayLoan = api.repayLoan as jest.MockedFunction<typeof api.repayLoan>;

const activeLoan: Loan = {
  id: 'loan-1', friendName: 'Aarav Sharma', amount: 2500, currency: 'INR', dueDate: '2026-10-30',
  status: 'OUTSTANDING', isOverdue: false, receiptAvailable: false, receipt: null,
  createdAt: '2026-10-20T00:00:00.000Z', updatedAt: '2026-10-20T00:00:00.000Z', repaidAt: null,
};
const overdueLoan: Loan = { ...activeLoan, id: 'loan-2', friendName: 'Priya Nair', amount: 1200, dueDate: '2026-10-01', isOverdue: true };
const repaidLoan: Loan = { ...activeLoan, id: 'loan-3', friendName: 'Karan Mehta', amount: 5000, status: 'REPAID', repaidAt: '2026-10-22T00:00:00.000Z' };
const totals: Summary = {
  currency: 'INR', totalLent: 8700, totalRepaid: 5000, outstandingAmount: 3700,
  overdueAmount: 1200, activeLoanCount: 2, repaidLoanCount: 1, overdueLoanCount: 1,
};

beforeEach(() => jest.clearAllMocks());

it('keeps loading, empty, and failed requests visually distinct', async () => {
  let finishLoans!: (value: { loans: Loan[] }) => void;
  let finishSummary!: (value: Summary) => void;
  loans.mockReturnValueOnce(new Promise((resolve) => { finishLoans = resolve; }));
  summary.mockReturnValueOnce(new Promise((resolve) => { finishSummary = resolve; }));
  const loading = await render(<DashboardScreen />, { wrapper: TestQueryProvider });
  expect(loading.getByText('Loading your ledger…')).toBeTruthy();
  await loading.unmount();
  finishLoans({ loans: [] });
  finishSummary(totals);

  loans.mockResolvedValueOnce({ loans: [] });
  summary.mockResolvedValueOnce({ ...totals, totalLent: 0, totalRepaid: 0, outstandingAmount: 0, overdueAmount: 0, activeLoanCount: 0, repaidLoanCount: 0, overdueLoanCount: 0 });
  const empty = await render(<DashboardScreen />, { wrapper: TestQueryProvider });
  expect(await empty.findByText('Your ledger is ready')).toBeTruthy();
  await empty.unmount();

  loans.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'Connection unavailable.'));
  summary.mockResolvedValueOnce(totals);
  const failed = await render(<DashboardScreen />, { wrapper: TestQueryProvider });
  expect(await failed.findByText('We couldn’t load this')).toBeTruthy();
  expect(failed.getByText('Connection unavailable.')).toBeTruthy();
  expect(failed.queryByText('Your ledger is ready')).toBeNull();
  await failed.unmount();
});

it('renders server summary values, filters loans, and spells out overdue status', async () => {
  loans.mockResolvedValue({ loans: [activeLoan, overdueLoan, repaidLoan] });
  summary.mockResolvedValue(totals);
  const screen = await render(<DashboardScreen />, { wrapper: TestQueryProvider });

  expect(await screen.findByText('₹3,700')).toBeTruthy();
  expect(screen.getByText('₹8,700')).toBeTruthy();
  expect(screen.getByText('1 loan needs your attention')).toBeTruthy();
  expect(screen.getByText('OVERDUE')).toBeTruthy();
  expect(screen.getByLabelText(/Priya Nair.*overdue/i)).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Show repaid loans'));
  await waitFor(() => expect(screen.queryByText('Aarav Sharma')).toBeNull());
  expect(screen.getByText('Karan Mehta')).toBeTruthy();
  await screen.unmount();
});

it('blocks repeated repayment activation while the first request is pending', async () => {
  loans.mockResolvedValue({ loans: [activeLoan] });
  summary.mockResolvedValue(totals);
  let failRepayment!: (error: Error) => void;
  repayLoan.mockReturnValue(new Promise((_resolve, reject) => { failRepayment = reject; }));
  const screen = await render(<DashboardScreen />, { wrapper: TestQueryProvider });
  const action = await screen.findByLabelText("Mark Aarav Sharma's loan as repaid");
  await fireEvent.press(action);
  await fireEvent.press(action);
  await waitFor(() => expect(repayLoan).toHaveBeenCalledTimes(1));
  await act(() => failRepayment(new ApiError(503, 'UNAVAILABLE', 'Please try again.')));
  await waitFor(() => expect(notify).toHaveBeenCalledWith('Couldn’t update loan', 'Please try again.'));
  await waitFor(() => expect(screen.getByLabelText("Mark Aarav Sharma's loan as repaid")).not.toBeDisabled());
  await screen.unmount();
});

it('shows a successful repayment and refreshes list, detail, and summary queries', async () => {
  const settled = { ...activeLoan, status: 'REPAID' as const, repaidAt: '2026-10-23T00:00:00.000Z' };
  loans.mockResolvedValueOnce({ loans: [activeLoan] }).mockResolvedValue({ loans: [settled] });
  summary.mockResolvedValueOnce(totals).mockResolvedValue({
    ...totals, totalRepaid: 7500, outstandingAmount: 1200, activeLoanCount: 1, repaidLoanCount: 2,
  });
  repayLoan.mockResolvedValue({ loan: settled });
  const client = createTestClient();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const screen = await render(<TestQueryProvider client={client}><DashboardScreen /></TestQueryProvider>);

  await fireEvent.press(await screen.findByLabelText("Mark Aarav Sharma's loan as repaid"));
  expect(await screen.findByText('Aarav Sharma’s loan is settled.')).toBeTruthy();
  await waitFor(() => expect(screen.getByText('REPAID')).toBeTruthy());
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['loans'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['summary'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['loan', 'loan-1'] });
  await screen.unmount();
});
