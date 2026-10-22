import { api, ApiError, configureApi } from '@/lib/api';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  configureApi(null);
  jest.clearAllMocks();
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
