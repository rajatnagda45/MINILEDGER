import { render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { ReceiptImage } from '@/components/receipt-image';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return { ...actual, api: { ...actual.api, fetchReceiptBlob: jest.fn(), receiptEndpoint: jest.fn() } };
});

const fetchReceiptBlob = api.fetchReceiptBlob as jest.MockedFunction<typeof api.fetchReceiptBlob>;
const originalOS = Platform.OS;

beforeAll(() => Object.defineProperty(Platform, 'OS', { value: 'web' }));
afterAll(() => Object.defineProperty(Platform, 'OS', { value: originalOS }));
beforeEach(() => jest.clearAllMocks());

it('aborts an authenticated web preview request when the image unmounts', async () => {
  let capturedSignal: AbortSignal | undefined;
  fetchReceiptBlob.mockImplementation((_loanId, signal) => {
    capturedSignal = signal;
    return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => {
      const error = new Error('cancelled');
      error.name = 'AbortError';
      reject(error);
    }, { once: true }));
  });
  const screen = await render(<ReceiptImage loanId="loan-1" token={0} />);
  await waitFor(() => expect(fetchReceiptBlob).toHaveBeenCalledWith('loan-1', expect.any(AbortSignal)));
  await screen.unmount();
  expect(capturedSignal?.aborted).toBe(true);
});
