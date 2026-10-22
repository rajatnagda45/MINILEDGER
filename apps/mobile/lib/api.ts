import type { ApiErrorBody, AuthSession, Loan, Summary } from '@miniledger/shared';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:4000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly details?: unknown) {
    super(message);
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function configureApi(sessionToken: string | null, unauthorized?: () => void) {
  token = sessionToken;
  onUnauthorized = unauthorized ?? null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      let body: ApiErrorBody | null = null;
      try { body = await response.json() as ApiErrorBody; } catch { /* use fallback */ }
      if (response.status === 401 && token) onUnauthorized?.();
      throw new ApiError(response.status, body?.error.code ?? 'REQUEST_FAILED', body?.error.message ?? 'Unable to complete the request.', body?.error.details);
    }
    return await response.json() as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new ApiError(0, 'TIMEOUT', 'The server took too long to respond.');
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach MiniLedger. Check your connection and API URL.');
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  sendOtp: (phoneNumber: string) => request<{ phoneNumber: string; expiresInSeconds: number; resendInSeconds: number }>('/auth/send-otp', {
    method: 'POST', body: JSON.stringify({ phoneNumber }),
  }),
  verifyOtp: (phoneNumber: string, otp: string) => request<AuthSession>('/auth/verify-otp', {
    method: 'POST', body: JSON.stringify({ phoneNumber, otp }),
  }),
  loans: () => request<{ loans: Loan[] }>('/loans'),
  loan: (id: string) => request<{ loan: Loan }>(`/loans/${id}`),
  summary: () => request<Summary>('/summary'),
  createLoan: (input: { friendName: string; amount: number; dueDate: string }) => request<{ loan: Loan }>('/loans', {
    method: 'POST', body: JSON.stringify(input),
  }),
  repayLoan: (id: string) => request<{ loan: Loan }>(`/loans/${id}/repay`, { method: 'PATCH' }),
};

