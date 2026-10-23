import { Platform } from 'react-native';
import type { ApiErrorBody, AuthSession, Loan, Summary } from '@miniledger/shared';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:4000/api').replace(/\/$/, '');

export interface ReceiptAsset { uri: string; name: string; mimeType: string }

const WEB_RECEIPT_MAX_DIMENSION = 4096;
const WEB_RECEIPT_MAX_PIXELS = 16_000_000;
const WEB_RECEIPT_JPEG_QUALITY = 0.86;

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly details?: unknown) {
    super(message);
  }
}

function detectedReceiptMimeType(blob: Blob): Promise<'image/jpeg' | 'image/png' | null> {
  return blob.slice(0, 12).arrayBuffer().then((header) => {
    const bytes = new Uint8Array(header);
    if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)) {
      return 'image/png';
    }
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
    return null;
  });
}

function jpegFilename(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, '').trim();
  return `${base || 'receipt'}.jpg`;
}

/**
 * The browser picker exposes every image format the browser can preview, while
 * the API deliberately stores only structurally validated JPEG/PNG bytes. Keep
 * that backend boundary and convert other browser-decodable formats (for
 * example WebP or AVIF) to a bounded JPEG before upload.
 */
export async function prepareWebReceipt(asset: ReceiptAsset): Promise<{ blob: Blob; name: string }> {
  const response = await fetch(asset.uri);
  if (!response.ok) throw new ApiError(0, 'RECEIPT_READ_FAILED', 'The selected image could not be read. Choose it again.');
  const sourceBlob = await response.blob();
  const detectedType = await detectedReceiptMimeType(sourceBlob);
  if (detectedType) return { blob: sourceBlob, name: asset.name };

  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    throw new ApiError(415, 'RECEIPT_INVALID_TYPE', 'Choose a JPEG or PNG image. This image format cannot be converted by your browser.');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(sourceBlob);
  } catch {
    throw new ApiError(415, 'RECEIPT_INVALID_TYPE', 'Choose a JPEG or PNG image. This image format cannot be converted by your browser.');
  }

  try {
    const scale = Math.min(
      1,
      WEB_RECEIPT_MAX_DIMENSION / bitmap.width,
      WEB_RECEIPT_MAX_DIMENSION / bitmap.height,
      Math.sqrt(WEB_RECEIPT_MAX_PIXELS / (bitmap.width * bitmap.height)),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    // JPEG has no alpha channel. A white background keeps transparent receipt
    // scans readable instead of turning transparent pixels black.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const converted = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Image conversion failed')),
        'image/jpeg',
        WEB_RECEIPT_JPEG_QUALITY,
      );
    });
    return { blob: converted, name: jpegFilename(asset.name) };
  } catch {
    throw new ApiError(415, 'RECEIPT_INVALID_TYPE', 'Choose a JPEG or PNG image. This image format cannot be converted by your browser.');
  } finally {
    bitmap.close();
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function configureApi(sessionToken: string | null, unauthorized?: () => void) {
  token = sessionToken;
  onUnauthorized = unauthorized ?? null;
}

function timedSignal(external?: AbortSignal) {
  const controller = new AbortController();
  let timedOut = false;
  const forwardAbort = () => controller.abort();
  if (external?.aborted) controller.abort();
  else external?.addEventListener('abort', forwardAbort, { once: true });
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 12_000);
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    cleanup: () => { clearTimeout(timeout); external?.removeEventListener('abort', forwardAbort); },
  };
}

async function request<T>(path: string, options: RequestInit = {}, externalSignal?: AbortSignal): Promise<T> {
  const abort = timedSignal(externalSignal);
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
      signal: abort.signal,
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
    if (error instanceof Error && error.name === 'AbortError') {
      if (!abort.timedOut()) throw error;
      throw new ApiError(0, 'TIMEOUT', 'The server took too long to respond.');
    }
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach MiniLedger. Check your connection and API URL.');
  } finally {
    abort.cleanup();
  }
}

export const api = {
  sendOtp: (phoneNumber: string) => request<{ phoneNumber: string; expiresInSeconds: number; resendInSeconds: number }>('/auth/send-otp', {
    method: 'POST', body: JSON.stringify({ phoneNumber }),
  }),
  verifyOtp: (phoneNumber: string, otp: string) => request<AuthSession>('/auth/verify-otp', {
    method: 'POST', body: JSON.stringify({ phoneNumber, otp }),
  }),
  // Validate a persisted bearer token through an existing authenticated route.
  // The summary response is intentionally discarded: React Query remains the
  // source of cached dashboard data after authentication restoration completes.
  validateSession: async () => { await request<Summary>('/summary'); },
  loans: (signal?: AbortSignal) => request<{ loans: Loan[] }>('/loans', {}, signal),
  loan: (id: string, signal?: AbortSignal) => request<{ loan: Loan }>(`/loans/${id}`, {}, signal),
  summary: (signal?: AbortSignal) => request<Summary>('/summary', {}, signal),
  createLoan: (input: { friendName: string; amount: number; dueDate: string }) => request<{ loan: Loan }>('/loans', {
    method: 'POST', body: JSON.stringify(input),
  }),
  repayLoan: (id: string) => request<{ loan: Loan }>(`/loans/${id}/repay`, { method: 'PATCH' }),
  uploadReceipt: async (loanId: string, asset: ReceiptAsset) => {
    const form = new FormData();
    if (Platform.OS === 'web') {
      const prepared = await prepareWebReceipt(asset);
      form.append('receipt', prepared.blob, prepared.name);
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
  fetchReceiptBlob: async (loanId: string, externalSignal?: AbortSignal): Promise<Blob> => {
    const abort = timedSignal(externalSignal);
    try {
      const response = await fetch(`${API_URL}/loans/${loanId}/receipt`, {
        headers: { Accept: 'image/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        signal: abort.signal,
      });
      if (!response.ok) {
        if (response.status === 401 && token) onUnauthorized?.();
        throw new ApiError(response.status, response.status === 404 ? 'RECEIPT_NOT_FOUND' : 'REQUEST_FAILED', 'Could not load the receipt.');
      }
      return await response.blob();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        if (!abort.timedOut()) throw error;
        throw new ApiError(0, 'TIMEOUT', 'The receipt took too long to load.');
      }
      throw new ApiError(0, 'NETWORK_ERROR', 'Could not load the receipt. Check your connection.');
    } finally {
      abort.cleanup();
    }
  },
};

