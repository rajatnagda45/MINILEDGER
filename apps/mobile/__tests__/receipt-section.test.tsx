import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReceiptMeta } from '@miniledger/shared';
import { ReceiptSection } from '@/components/receipt-section';
import { api, ApiError } from '@/lib/api';
import { notify } from '@/lib/confirm';
import { createTestClient, TestQueryProvider } from './test-utils';

jest.mock('@/components/receipt-image', () => {
  const { View } = jest.requireActual('react-native');
  return { ReceiptImage: () => <View accessibilityLabel="Receipt image" /> };
});
jest.mock('@/components/receipt-picker', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    ReceiptPicker: ({ onChange }: { onChange: (asset: { uri: string; name: string; mimeType: string }) => void }) => (
      <Pressable accessibilityRole="button" onPress={() => onChange({ uri: 'file:///new.png', name: 'new.png', mimeType: 'image/png' })}>
        <Text>Pick test receipt</Text>
      </Pressable>
    ),
  };
});
jest.mock('@/lib/confirm', () => ({
  confirmAction: jest.fn((_options, onConfirm: () => void) => onConfirm()),
  notify: jest.fn(),
}));
jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return { ...actual, api: { ...actual.api, uploadReceipt: jest.fn(), deleteReceipt: jest.fn() } };
});

const uploadReceipt = api.uploadReceipt as jest.MockedFunction<typeof api.uploadReceipt>;
const deleteReceipt = api.deleteReceipt as jest.MockedFunction<typeof api.deleteReceipt>;
const receipt: ReceiptMeta = { mimeType: 'image/png', byteSize: 2048, createdAt: '2026-10-23T00:00:00.000Z' };

beforeEach(() => jest.clearAllMocks());

it('reports an upload failure and keeps financial summary queries untouched', async () => {
  uploadReceipt.mockRejectedValue(new ApiError(415, 'RECEIPT_INVALID_TYPE', 'Use a valid JPEG or PNG.'));
  const client = createTestClient();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const screen = await render(<TestQueryProvider client={client}><ReceiptSection loanId="loan-1" receipt={null} /></TestQueryProvider>);
  await fireEvent.press(screen.getByText('Pick test receipt'));

  await waitFor(() => expect(notify).toHaveBeenCalledWith('Upload failed', 'Use a valid JPEG or PNG.'));
  expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['summary'] });
});

it('uploads a replacement and refreshes only loan views', async () => {
  uploadReceipt.mockResolvedValue({ loan: {} as never });
  const client = createTestClient();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const screen = await render(<TestQueryProvider client={client}><ReceiptSection loanId="loan-1" receipt={receipt} /></TestQueryProvider>);
  await fireEvent.press(screen.getByText('Replace'));
  await fireEvent.press(screen.getByText('Pick test receipt'));

  await waitFor(() => expect(uploadReceipt).toHaveBeenCalledWith('loan-1', { uri: 'file:///new.png', name: 'new.png', mimeType: 'image/png' }));
  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['loan', 'loan-1'] }));
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['loans'] });
  expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['summary'] });
});

it('confirms removal, prevents repeated deletion while pending, and refreshes loan views', async () => {
  let finish!: () => void;
  deleteReceipt.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
  const client = createTestClient();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const screen = await render(<TestQueryProvider client={client}><ReceiptSection loanId="loan-1" receipt={receipt} /></TestQueryProvider>);
  const remove = screen.getByText('Remove');
  await fireEvent.press(remove);
  await fireEvent.press(remove);
  expect(deleteReceipt).toHaveBeenCalledTimes(1);
  finish();
  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['loan', 'loan-1'] }));
});
