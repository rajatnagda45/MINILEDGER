import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Env } from '../src/config/env.js';
import type { ReceiptInput } from '../src/data/types.js';
import { ReceiptService } from '../src/modules/receipts/receipt-service.js';
import type { ReceiptStorage } from '../src/modules/receipts/storage.js';
import { NOT_AN_IMAGE, TRUNCATED_JPEG, TRUNCATED_PNG, VALID_JPEG, VALID_PNG, oversizedPng } from './fixtures.js';
import { MemoryStore } from './memory-store.js';

const env: Env = {
  NODE_ENV: 'test',
  PORT: 4000,
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_SECRET: 'test-secret-that-is-definitely-at-least-32-characters',
  OTP_PEPPER: 'test-otp-pepper-is-long-enough',
  JWT_EXPIRES_IN: '1h',
  APP_TIME_ZONE: 'Asia/Kolkata',
  MOBILE_ORIGIN: '*',
  RECEIPT_STORAGE_DIR: '.receipts-test',
  RECEIPT_MAX_BYTES: 5 * 1024 * 1024,
};

// Deterministic, in-memory storage that lets tests inspect and fail operations.
class FakeStorage implements ReceiptStorage {
  readonly objects = new Map<string, Buffer>();
  readonly saved: string[] = [];
  readonly deleted: string[] = [];
  failSave = false;
  failDelete = false;

  async save(bytes: Buffer, mimeType: 'image/jpeg' | 'image/png'): Promise<string> {
    if (this.failSave) throw new Error('simulated storage failure');
    const key = `${randomUUID()}.${mimeType === 'image/png' ? 'png' : 'jpg'}`;
    this.objects.set(key, Buffer.from(bytes));
    this.saved.push(key);
    return key;
  }
  async read(storageKey: string): Promise<Buffer> {
    const bytes = this.objects.get(storageKey);
    if (!bytes) throw new Error('object missing');
    return bytes;
  }
  async delete(storageKey: string): Promise<void> {
    if (this.failDelete) throw new Error('simulated delete failure');
    this.objects.delete(storageKey);
    this.deleted.push(storageKey);
  }
}

// Lets a single test simulate metadata-persistence failures.
class FailingStore extends MemoryStore {
  failUpsert = false;
  failDeleteReceipt = false;
  override async upsertReceipt(loanId: string, input: ReceiptInput) {
    if (this.failUpsert) throw new Error('simulated database failure');
    return super.upsertReceipt(loanId, input);
  }
  override async deleteReceiptByLoan(loanId: string) {
    if (this.failDeleteReceipt) throw new Error('simulated database failure');
    return super.deleteReceiptByLoan(loanId);
  }
}

const PNG = VALID_PNG;
const JPEG = VALID_JPEG;

function binaryParser(res: request.Response, callback: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

describe('receipts', () => {
  let app: Express;
  let store: FailingStore;
  let storage: FakeStorage;
  let now: Date;
  let issued: Map<string, string>;

  beforeEach(() => {
    store = new FailingStore();
    storage = new FakeStorage();
    now = new Date('2026-10-22T06:30:00.000Z');
    issued = new Map();
    app = createApp({ env, store, storage, now: () => now, onOtpIssued: (p, o) => issued.set(p, o), disableRateLimit: true });
  });

  async function signIn(phoneNumber = '+919876543210') {
    await request(app).post('/api/auth/send-otp').send({ phoneNumber }).expect(202);
    const otp = issued.get(phoneNumber)!;
    return (await request(app).post('/api/auth/verify-otp').send({ phoneNumber, otp }).expect(200)).body.token as string;
  }
  async function createLoan(token: string) {
    return (await request(app).post('/api/loans').set('Authorization', `Bearer ${token}`)
      .send({ friendName: 'Aarav Sharma', amount: 2500, dueDate: '2026-10-30' }).expect(201)).body.loan;
  }
  const upload = (token: string, loanId: string, file: Buffer, filename = 'receipt.png', contentType = 'image/png') =>
    request(app).post(`/api/loans/${loanId}/receipt`).set('Authorization', `Bearer ${token}`).attach('receipt', file, { filename, contentType });

  it('rejects upload without authentication', async () => {
    await upload('', randomUUID(), PNG).expect(401);
  });

  it('rejects upload to a nonexistent loan', async () => {
    const token = await signIn();
    const res = await upload(token, randomUUID(), PNG).expect(404);
    expect(res.body.error.code).toBe('LOAN_NOT_FOUND');
  });

  it("rejects upload to another user's loan", async () => {
    const owner = await signIn('+919876543210');
    const other = await signIn('+919876543211');
    const loan = await createLoan(owner);
    await upload(other, loan.id, PNG).expect(404);
    expect(storage.saved).toHaveLength(0);
  });

  it('stores a valid PNG and reports it on the loan', async () => {
    const token = await signIn();
    const loan = await createLoan(token);
    const res = await upload(token, loan.id, PNG).expect(201);
    expect(res.body.loan.receiptAvailable).toBe(true);
    expect(res.body.loan.receipt).toMatchObject({ mimeType: 'image/png', byteSize: PNG.length });
    expect(storage.objects.size).toBe(1);
  });

  it('stores a valid JPEG', async () => {
    const token = await signIn();
    const loan = await createLoan(token);
    const res = await upload(token, loan.id, JPEG, 'receipt.jpg', 'image/jpeg').expect(201);
    expect(res.body.loan.receipt.mimeType).toBe('image/jpeg');
  });

  it('rejects content whose bytes are not a supported image, even if the MIME claims otherwise', async () => {
    const token = await signIn();
    const loan = await createLoan(token);
    const res = await upload(token, loan.id, NOT_AN_IMAGE, 'receipt.png', 'image/png').expect(415);
    expect(res.body.error.code).toBe('RECEIPT_INVALID_TYPE');
    expect(storage.saved).toHaveLength(0);
  });

  it('rejects a truncated image even with a valid signature', async () => {
    const token = await signIn();
    const loan = await createLoan(token);
    expect((await upload(token, loan.id, TRUNCATED_PNG).expect(422)).body.error.code).toBe('RECEIPT_INVALID_IMAGE');
    expect((await upload(token, loan.id, TRUNCATED_JPEG, 'r.jpg', 'image/jpeg').expect(422)).body.error.code).toBe('RECEIPT_INVALID_IMAGE');
    expect(storage.saved).toHaveLength(0);
  });

  it('rejects an image with excessive declared dimensions', async () => {
    const token = await signIn();
    const loan = await createLoan(token);
    expect((await upload(token, loan.id, oversizedPng()).expect(422)).body.error.code).toBe('RECEIPT_INVALID_IMAGE');
    expect(storage.saved).toHaveLength(0);
  });

  it('rejects an empty or missing file', async () => {
    const token = await signIn();
    const loan = await createLoan(token);
    await upload(token, loan.id, Buffer.alloc(0)).expect(422);
    const missing = await request(app).post(`/api/loans/${loan.id}/receipt`).set('Authorization', `Bearer ${token}`).expect(422);
    expect(missing.body.error.code).toBe('RECEIPT_REQUIRED');
  });

  it('rejects an oversized upload', async () => {
    const token = await signIn();
    const loan = await createLoan(token);
    const smallApp = createApp({ env: { ...env, RECEIPT_MAX_BYTES: 16 }, store, storage, now: () => now, disableRateLimit: true });
    const res = await request(smallApp).post(`/api/loans/${loan.id}/receipt`).set('Authorization', `Bearer ${token}`)
      .attach('receipt', PNG, { filename: 'receipt.png', contentType: 'image/png' }).expect(413);
    expect(res.body.error.code).toBe('RECEIPT_TOO_LARGE');
  });

  it('rejects an invalid loan id', async () => {
    const token = await signIn();
    await request(app).get('/api/loans/not-a-uuid/receipt').set('Authorization', `Bearer ${token}`).expect(422);
    await request(app).delete('/api/loans/not-a-uuid/receipt').set('Authorization', `Bearer ${token}`).expect(422);
  });

  it('serves the receipt to the owner with safe headers and denies other users', async () => {
    const owner = await signIn('+919876543210');
    const other = await signIn('+919876543211');
    const loan = await createLoan(owner);
    await upload(owner, loan.id, PNG).expect(201);

    const res = await request(app).get(`/api/loans/${loan.id}/receipt`).set('Authorization', `Bearer ${owner}`)
      .buffer(true).parse(binaryParser).expect(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.compare(res.body as Buffer, PNG)).toBe(0);

    await request(app).get(`/api/loans/${loan.id}/receipt`).set('Authorization', `Bearer ${other}`).expect(404);
  });

  it("denies cross-user receipt deletion without revealing the receipt", async () => {
    const owner = await signIn('+919876543210');
    const other = await signIn('+919876543211');
    const loan = await createLoan(owner);
    await upload(owner, loan.id, PNG).expect(201);
    await request(app).delete(`/api/loans/${loan.id}/receipt`).set('Authorization', `Bearer ${other}`).expect(404);
    // Owner's receipt is untouched.
    await request(app).get(`/api/loans/${loan.id}/receipt`).set('Authorization', `Bearer ${owner}`).expect(200);
    expect(storage.objects.size).toBe(1);
  });

  it('returns 404 for a missing receipt on get and delete', async () => {
    const token = await signIn();
    const loan = await createLoan(token);
    expect((await request(app).get(`/api/loans/${loan.id}/receipt`).set('Authorization', `Bearer ${token}`).expect(404)).body.error.code).toBe('RECEIPT_NOT_FOUND');
    expect((await request(app).delete(`/api/loans/${loan.id}/receipt`).set('Authorization', `Bearer ${token}`).expect(404)).body.error.code).toBe('RECEIPT_NOT_FOUND');
  });

  it('removes a receipt and its stored object', async () => {
    const token = await signIn();
    const loan = await createLoan(token);
    await upload(token, loan.id, PNG).expect(201);
    await request(app).delete(`/api/loans/${loan.id}/receipt`).set('Authorization', `Bearer ${token}`).expect(204);
    expect(storage.objects.size).toBe(0);
    const after = await request(app).get(`/api/loans/${loan.id}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(after.body.loan.receiptAvailable).toBe(false);
  });

  it('deletes the orphaned object when metadata persistence fails', async () => {
    const token = await signIn();
    const loan = await createLoan(token);
    store.failUpsert = true;
    await upload(token, loan.id, PNG).expect(500);
    expect(storage.saved).toHaveLength(1);
    expect(storage.deleted).toEqual(storage.saved);
    expect(storage.objects.size).toBe(0);
    expect(await store.findReceiptByLoan(loan.id)).toBeNull();
  });

  it('does not persist metadata when the storage write fails', async () => {
    const token = await signIn();
    const loan = await createLoan(token);
    storage.failSave = true;
    await upload(token, loan.id, PNG).expect(500);
    expect(await store.findReceiptByLoan(loan.id)).toBeNull();
  });

  it('preserves the previous receipt when a replacement fails', async () => {
    const token = await signIn();
    const loan = await createLoan(token);
    await upload(token, loan.id, PNG).expect(201);
    store.failUpsert = true;
    await upload(token, loan.id, JPEG, 'new.jpg', 'image/jpeg').expect(500);
    // The original attachment must still be intact and retrievable.
    const res = await request(app).get(`/api/loans/${loan.id}/receipt`).set('Authorization', `Bearer ${token}`)
      .buffer(true).parse(binaryParser).expect(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(Buffer.compare(res.body as Buffer, PNG)).toBe(0);
    expect(storage.objects.size).toBe(1);
  });

  it('replaces an existing receipt and cleans up the previous object', async () => {
    const token = await signIn();
    const loan = await createLoan(token);
    await upload(token, loan.id, PNG).expect(201);
    const firstKey = storage.saved[0]!;
    await upload(token, loan.id, JPEG, 'new.jpg', 'image/jpeg').expect(201);
    expect(storage.deleted).toContain(firstKey);
    expect(storage.objects.size).toBe(1);
    const res = await request(app).get(`/api/loans/${loan.id}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.loan.receipt.mimeType).toBe('image/jpeg');
  });

  it('keeps the receipt intact and retryable when the file deletion fails', async () => {
    const token = await signIn();
    const loan = await createLoan(token);
    await upload(token, loan.id, PNG).expect(201);
    storage.failDelete = true;
    // The delete must NOT report success while the private file still exists.
    await request(app).delete(`/api/loans/${loan.id}/receipt`).set('Authorization', `Bearer ${token}`).expect(500);
    // Metadata preserved, so the receipt is still fully usable and consistent.
    expect((await request(app).get(`/api/loans/${loan.id}`).set('Authorization', `Bearer ${token}`).expect(200)).body.loan.receiptAvailable).toBe(true);
    await request(app).get(`/api/loans/${loan.id}/receipt`).set('Authorization', `Bearer ${token}`).expect(200);
    // Retrying after the storage recovers succeeds and fully removes it.
    storage.failDelete = false;
    await request(app).delete(`/api/loans/${loan.id}/receipt`).set('Authorization', `Bearer ${token}`).expect(204);
    expect(storage.objects.size).toBe(0);
  });

  it('reconciles after a metadata delete failure that follows a successful file delete', async () => {
    const token = await signIn();
    const loan = await createLoan(token);
    await upload(token, loan.id, PNG).expect(201);
    store.failDeleteReceipt = true;
    await request(app).delete(`/api/loans/${loan.id}/receipt`).set('Authorization', `Bearer ${token}`).expect(500);
    // The object was already deleted; a retry is idempotent and reconciles state.
    store.failDeleteReceipt = false;
    await request(app).delete(`/api/loans/${loan.id}/receipt`).set('Authorization', `Bearer ${token}`).expect(204);
    expect((await request(app).get(`/api/loans/${loan.id}`).set('Authorization', `Bearer ${token}`).expect(200)).body.loan.receiptAvailable).toBe(false);
  });

  it('tombstones the previous object when replacement cleanup fails, then reconciles it', async () => {
    const token = await signIn();
    const loan = await createLoan(token);
    await upload(token, loan.id, PNG).expect(201);
    const oldKey = storage.saved[0]!;
    storage.failDelete = true;
    // Replacement still succeeds; the orphaned old object is recorded, not lost.
    await upload(token, loan.id, JPEG, 'new.jpg', 'image/jpeg').expect(201);
    expect((await store.listOrphans()).map((o) => o.storageKey)).toContain(oldKey);
    expect(storage.objects.has(oldKey)).toBe(true);
    // Reconciliation retries the deletion and clears the tombstone.
    storage.failDelete = false;
    const result = await new ReceiptService(store, storage).reconcileOrphans();
    expect(result.deleted).toBe(1);
    expect(await store.listOrphans()).toHaveLength(0);
    expect(storage.objects.has(oldKey)).toBe(false);
  });

  it('tombstones an orphan when both metadata persistence and its cleanup fail', async () => {
    const token = await signIn();
    const loan = await createLoan(token);
    store.failUpsert = true;
    storage.failDelete = true;
    await upload(token, loan.id, PNG).expect(500);
    const newKey = storage.saved[0]!;
    expect((await store.listOrphans()).map((o) => o.storageKey)).toContain(newKey);
    expect(await store.findReceiptByLoan(loan.id)).toBeNull();
    storage.failDelete = false;
    const result = await new ReceiptService(store, storage).reconcileOrphans();
    expect(result.deleted).toBe(1);
  });

  it('does not change financial totals when a receipt is added or removed', async () => {
    const token = await signIn();
    const loan = await createLoan(token);
    const before = (await request(app).get('/api/summary').set('Authorization', `Bearer ${token}`).expect(200)).body;
    await upload(token, loan.id, PNG).expect(201);
    const withReceipt = (await request(app).get('/api/summary').set('Authorization', `Bearer ${token}`).expect(200)).body;
    await request(app).delete(`/api/loans/${loan.id}/receipt`).set('Authorization', `Bearer ${token}`).expect(204);
    const afterRemoval = (await request(app).get('/api/summary').set('Authorization', `Bearer ${token}`).expect(200)).body;
    expect(withReceipt).toEqual(before);
    expect(afterRemoval).toEqual(before);
  });
});
