import { Platform } from 'react-native';
import { api, ApiError, configureApi, prepareWebReceipt } from '@/lib/api';

const originalFetch = global.fetch;
const originalOS = Platform.OS;
const originalCreateImageBitmap = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap');
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');

afterEach(() => {
  jest.useRealTimers();
  global.fetch = originalFetch;
  Object.defineProperty(Platform, 'OS', { value: originalOS });
  if (originalCreateImageBitmap) Object.defineProperty(globalThis, 'createImageBitmap', originalCreateImageBitmap);
  else delete (globalThis as { createImageBitmap?: typeof createImageBitmap }).createImageBitmap;
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
  else delete (globalThis as { document?: Document }).document;
  configureApi(null);
  jest.restoreAllMocks();
});

it('passes through a selected PNG after checking its actual bytes', async () => {
  const png = new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], { type: 'image/png' });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: async () => png }) as jest.Mock;

  await expect(prepareWebReceipt({ uri: 'blob:receipt', name: 'receipt.png', mimeType: 'image/png' }))
    .resolves.toEqual({ blob: png, name: 'receipt.png' });
});

it('converts a browser-supported WebP selection to a bounded JPEG before upload', async () => {
  const webp = new Blob([Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])], { type: 'image/webp' });
  const jpeg = new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });
  const close = jest.fn();
  const bitmap = { width: 6000, height: 3000, close } as unknown as ImageBitmap;
  const context = { fillStyle: '', fillRect: jest.fn(), drawImage: jest.fn() };
  const canvas = {
    width: 0,
    height: 0,
    getContext: jest.fn(() => context),
    toBlob: jest.fn((callback: BlobCallback) => callback(jpeg)),
  } as unknown as HTMLCanvasElement;

  global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: async () => webp }) as jest.Mock;
  Object.defineProperty(globalThis, 'createImageBitmap', { configurable: true, value: jest.fn().mockResolvedValue(bitmap) });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: jest.fn(() => canvas) },
  });

  await expect(prepareWebReceipt({ uri: 'blob:receipt', name: 'receipt.webp', mimeType: 'image/webp' }))
    .resolves.toEqual({ blob: jpeg, name: 'receipt.jpg' });
  expect(canvas.width).toBe(4096);
  expect(canvas.height).toBe(2048);
  expect(context.fillRect).toHaveBeenCalledWith(0, 0, 4096, 2048);
  expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 4096, 2048);
  expect(close).toHaveBeenCalledTimes(1);
});

it('uploads the prepared browser receipt through the existing multipart endpoint', async () => {
  Object.defineProperty(Platform, 'OS', { value: 'web' });
  const png = new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], { type: 'image/png' });
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, blob: async () => png })
    .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ loan: { id: 'loan-1' } }) }) as jest.Mock;

  await expect(api.uploadReceipt('loan-1', { uri: 'blob:receipt', name: 'receipt.png', mimeType: 'image/png' }))
    .resolves.toEqual({ loan: { id: 'loan-1' } });
  expect(global.fetch).toHaveBeenNthCalledWith(
    2,
    expect.stringMatching(/\/loans\/loan-1\/receipt$/),
    expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
  );
});

it('forwards query cancellation to fetch without misreporting it as a timeout', async () => {
  global.fetch = jest.fn((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      const error = new Error('cancelled');
      error.name = 'AbortError';
      reject(error);
    }, { once: true });
  })) as jest.Mock;
  const controller = new AbortController();
  const request = api.loans(controller.signal);
  controller.abort();

  await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  expect((global.fetch as jest.Mock).mock.calls[0][1].signal.aborted).toBe(true);
});

it('reports transport failures as network errors', async () => {
  global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch')) as jest.Mock;

  await expect(api.loans()).rejects.toEqual(new ApiError(0, 'NETWORK_ERROR', 'Could not reach MiniLedger. Check your connection and API URL.'));
});

it('reports the internal request deadline as a timeout', async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      const error = new Error('timed out');
      error.name = 'AbortError';
      reject(error);
    }, { once: true });
  })) as jest.Mock;
  const result = expect(api.loans()).rejects.toEqual(new ApiError(0, 'TIMEOUT', 'The server took too long to respond.'));

  await jest.advanceTimersByTimeAsync(12_000);
  await result;
});

it('uses the configured unauthorized handler for expired protected requests', async () => {
  const unauthorized = jest.fn();
  configureApi('expired-token', unauthorized);
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ error: { code: 'SESSION_EXPIRED', message: 'Sign in again.' } }),
  }) as jest.Mock;

  await expect(api.summary()).rejects.toEqual(new ApiError(401, 'SESSION_EXPIRED', 'Sign in again.'));
  expect(unauthorized).toHaveBeenCalledTimes(1);
});

it('validates a restored session through the existing authenticated summary route', async () => {
  configureApi('saved-token');
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ currency: 'INR', totalLent: 0, totalRepaid: 0, outstandingAmount: 0, overdueAmount: 0, activeLoanCount: 0, repaidLoanCount: 0, overdueLoanCount: 0 }),
  }) as jest.Mock;

  await expect(api.validateSession()).resolves.toBeUndefined();
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringMatching(/\/summary$/),
    expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer saved-token' }) }),
  );
});
