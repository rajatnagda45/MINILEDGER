import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';
import { useInteraction } from '@/providers/interaction-provider';
import { TestQueryProvider } from './test-utils';

function Harness({ action = jest.fn() }: { action?: () => void | Promise<void> }) {
  const { confirm, notify } = useInteraction();
  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel="Open confirmation" onPress={() => confirm({
        title: 'Confirm payment',
        message: 'Confirm that Dev returned ₹2,500.',
        confirmLabel: 'Mark repaid',
        pendingLabel: 'Marking as repaid…',
      }, action)}><Text>Open confirmation</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Show notice" onPress={() => notify({ tone: 'success', title: 'Saved', message: 'Your changes are live.' })}><Text>Show notice</Text></Pressable>
    </View>
  );
}

it('names the dialog accessibly and lets Cancel or the platform close request dismiss it', async () => {
  const action = jest.fn();
  const screen = await render(<Harness action={action} />, { wrapper: TestQueryProvider });
  await fireEvent.press(screen.getByLabelText('Open confirmation'));
  const dialog = screen.getByTestId('confirmation-dialog-panel');
  expect(dialog.props.role).toBe('dialog');
  expect(dialog.props.accessibilityViewIsModal).toBe(true);
  expect(dialog.props['aria-labelledby']).toBe('confirmation-dialog-title');
  expect(dialog.props['aria-describedby']).toBe('confirmation-dialog-message');
  await fireEvent.press(screen.getByLabelText('Cancel'));
  expect(action).not.toHaveBeenCalled();
  expect(screen.queryByText('Confirm payment')).toBeNull();

  await fireEvent.press(screen.getByLabelText('Open confirmation'));
  await fireEvent.press(screen.getByTestId('confirmation-backdrop', { includeHiddenElements: true }));
  expect(screen.queryByText('Confirm payment')).toBeNull();
  expect(action).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByLabelText('Open confirmation'));
  await act(() => screen.getByTestId('confirmation-dialog-modal').props.onRequestClose());
  expect(screen.queryByText('Confirm payment')).toBeNull();
  expect(action).not.toHaveBeenCalled();
});

it('prevents duplicate confirmation and restores retry after a failed action', async () => {
  let reject!: (error: Error) => void;
  const action = jest.fn(() => new Promise<void>((_resolve, fail) => { reject = fail; }));
  const screen = await render(<Harness action={action} />, { wrapper: TestQueryProvider });
  await fireEvent.press(screen.getByLabelText('Open confirmation'));
  const confirm = screen.getByLabelText('Mark repaid');
  await fireEvent.press(confirm);
  await fireEvent.press(confirm);
  expect(action).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Marking as repaid…')).toBeDisabled();

  reject(new Error('offline'));
  await waitFor(() => expect(screen.getByLabelText('Mark repaid')).not.toBeDisabled());
  expect(screen.getByText('Confirm payment')).toBeTruthy();
});

it('announces notifications and supports manual dismissal', async () => {
  const screen = await render(<Harness />, { wrapper: TestQueryProvider });
  await fireEvent.press(screen.getByLabelText('Show notice'));
  expect(screen.getByRole('status', { name: 'Saved. Your changes are live.' })).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Dismiss notification'));
  expect(screen.queryByText('Saved')).toBeNull();
});
