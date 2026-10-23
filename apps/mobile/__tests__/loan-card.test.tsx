import { fireEvent, render } from '@testing-library/react-native';
import type { Loan } from '@miniledger/shared';
import { LoanCard } from '@/components/loan-card';

const edgeCaseLoan: Loan = {
  id: 'loan-edge',
  friendName: 'An extraordinarily long friend name for layout verification',
  amount: 10_000_000,
  currency: 'INR',
  dueDate: '2026-10-01',
  status: 'OUTSTANDING',
  isOverdue: true,
  receiptAvailable: true,
  receipt: null,
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
  repaidAt: null,
};

it('keeps a long identity and maximum supported amount fully described', async () => {
  const onPress = jest.fn();
  const onRepay = jest.fn();
  const screen = await render(<LoanCard loan={edgeCaseLoan} onPress={onPress} onRepay={onRepay} wide />);

  const row = screen.getByLabelText(/An extraordinarily long friend name.*₹1,00,00,000.*overdue/i);
  expect(row).toBeTruthy();
  expect(screen.getByText('OVERDUE')).toBeTruthy();
  expect(screen.getByText('Receipt attached')).toBeTruthy();

  await fireEvent.press(row);
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(onRepay).not.toHaveBeenCalled();
});

it('keeps the repayment action distinct from opening the record', async () => {
  const onPress = jest.fn();
  const onRepay = jest.fn();
  const screen = await render(<LoanCard loan={edgeCaseLoan} onPress={onPress} onRepay={onRepay} wide />);

  await fireEvent.press(screen.getByLabelText(`Mark ${edgeCaseLoan.friendName}'s loan as repaid`));
  expect(onRepay).toHaveBeenCalledTimes(1);
  expect(onPress).not.toHaveBeenCalled();
});
