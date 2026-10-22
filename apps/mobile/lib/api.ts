import { Platform } from 'react-native';
import type { ApiErrorBody, AuthSession, Loan, Summary } from '@miniledger/shared';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:4000/api').replace(/\/$/, '');

export interface ReceiptAsset { uri: string; name: string; mimeType: string }

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
    const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        // Let fetch set the multipart boundary itself; only force JSON otherwise.
        ...(options.body && !isForm ? { 'Content-Type': 'application/json' } : {}),
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
    if (response.status === 204) return undefined as T;
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
  uploadReceipt: async (loanId: string, asset: ReceiptAsset) => {
    const form = new FormData();
    if (Platform.OS === 'web') {
      const blob = await (await fetch(asset.uri)).blob();
      form.append('receipt', blob, asset.name);
    } else {
      // React Native's FormData accepts a { uri, name, type } file descriptor.
      form.append('receipt', { uri: asset.uri, name: asset.name, type: asset.mimeType } as unknown as Blob);
    }
    return request<{ loan: Loan }>(`/loans/${loanId}/receipt`, { method: 'POST', body: form });
  },
  deleteReceipt: (loanId: string) => request<void>(`/loans/${loanId}/receipt`, { method: 'DELETE' }),
  // Full URL + auth header for retrieving a receipt image (see ReceiptImage).
  receiptEndpoint: (loanId: string) => `${API_URL}/loans/${loanId}/receipt`,
  authHeaders: () => (token ? { Authorization: `Bearer ${token}` } : {}),
  // Fetch a receipt image as a Blob (web). Shares the client's 401 handling, so
  // an expired session follows the app's normal sign-out flow instead of
  // surfacing as a generic preview error.
  fetchReceiptBlob: async (loanId: string): Promise<Blob> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`${API_URL}/loans/${loanId}/receipt`, {
        headers: { Accept: 'image/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 401 && token) onUnauthorized?.();
        throw new ApiError(response.status, response.status === 404 ? 'RECEIPT_NOT_FOUND' : 'REQUEST_FAILED', 'Could not load the receipt.');
      }
      return await response.blob();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') throw new ApiError(0, 'TIMEOUT', 'The receipt took too long to load.');
      throw new ApiError(0, 'NETWORK_ERROR', 'Could not load the receipt. Check your connection.');
    } finally {
      clearTimeout(timeout);
    }
  },
};

