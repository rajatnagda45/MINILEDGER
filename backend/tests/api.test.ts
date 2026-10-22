import type { Express } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import type { Env } from '../src/config/env.js';
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
};

describe('MiniLedger API', () => {
  let app: Express;
  let store: MemoryStore;
  let now: Date;
  let issuedCodes: Map<string, string>;

  beforeEach(() => {
    store = new MemoryStore();
    now = new Date('2026-10-22T06:30:00.000Z');
    issuedCodes = new Map();
    app = createApp({
      env,
      store,
      now: () => now,
      onOtpIssued: (phone, otp) => issuedCodes.set(phone, otp),
      disableRateLimit: true,
    });
  });

  afterEach(() => vi.restoreAllMocks());

  async function signIn(phoneNumber = '+919876543210') {
    await request(app).post('/api/auth/send-otp').send({ phoneNumber }).expect(202);
    const otp = issuedCodes.get(phoneNumber)!;
    const response = await request(app).post('/api/auth/verify-otp').send({ phoneNumber, otp }).expect(200);
    return response.body.token as string;
  }

  function createLoan(token: string, data = { friendName: 'Aarav Sharma', amount: 2500, dueDate: '2026-10-20' }) {
    return request(app).post('/api/loans').set('Authorization', `Bearer ${token}`).send(data);
  }

  describe('authentication', () => {
    it('issues a six-digit OTP for a valid normalized number', async () => {
      const response = await request(app).post('/api/auth/send-otp').send({ phoneNumber: '98765 43210' }).expect(202);
      expect(response.body).toMatchObject({ phoneNumber: '+919876543210', expiresInSeconds: 300, resendInSeconds: 30 });
      expect(issuedCodes.get('+919876543210')).toMatch(/^\d{6}$/);
    });

    it('rejects an invalid phone number', async () => {
      const response = await request(app).post('/api/auth/send-otp').send({ phoneNumber: '123' }).expect(422);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns a session for the correct OTP and rejects an incorrect OTP', async () => {
      const phoneNumber = '+919876543210';
      await request(app).post('/api/auth/send-otp').send({ phoneNumber }).expect(202);
      await request(app).post('/api/auth/verify-otp').send({ phoneNumber, otp: '999999' }).expect(400);
      const response = await request(app).post('/api/auth/verify-otp').send({ phoneNumber, otp: issuedCodes.get(phoneNumber) }).expect(200);
      expect(response.body.token).toEqual(expect.any(String));
      expect(response.body.user.phoneNumber).toBe(phoneNumber);
    });

    it('rejects expired and reused OTPs', async () => {
      const phoneNumber = '+919876543210';
      await request(app).post('/api/auth/send-otp').send({ phoneNumber }).expect(202);
      const otp = issuedCodes.get(phoneNumber)!;
      now = new Date(now.valueOf() + 301_000);
      expect((await request(app).post('/api/auth/verify-otp').send({ phoneNumber, otp }).expect(400)).body.error.code).toBe('OTP_EXPIRED');

      const secondPhone = '+919876543211';
      await request(app).post('/api/auth/send-otp').send({ phoneNumber: secondPhone }).expect(202);
      const secondOtp = issuedCodes.get(secondPhone)!;
      await request(app).post('/api/auth/verify-otp').send({ phoneNumber: secondPhone, otp: secondOtp }).expect(200);
      expect((await request(app).post('/api/auth/verify-otp').send({ phoneNumber: secondPhone, otp: secondOtp }).expect(400)).body.error.code).toBe('OTP_INVALID');
    });

    it('does not print development OTPs in production mode', async () => {
      const logger = vi.spyOn(console, 'info').mockImplementation(() => undefined);
      const productionApp = createApp({ env: { ...env, NODE_ENV: 'production' }, store });
      await request(productionApp).post('/api/auth/send-otp').send({ phoneNumber: '+919876543210' }).expect(202);
      expect(logger).not.toHaveBeenCalled();
    });
  });

  describe('loans and ownership', () => {
    it('creates and retrieves a valid loan for the authenticated user', async () => {
      const token = await signIn();
      const created = await createLoan(token).expect(201);
      expect(created.body.loan).toMatchObject({ friendName: 'Aarav Sharma', amount: 2500, isOverdue: true, status: 'OUTSTANDING' });
      const listed = await request(app).get('/api/loans').set('Authorization', `Bearer ${token}`).expect(200);
      expect(listed.body.loans).toHaveLength(1);
    });

    it.each([
      [{ friendName: 'A', amount: 500, dueDate: '2026-10-30' }, 'short name'],
      [{ friendName: 'Aarav', amount: -1, dueDate: '2026-10-30' }, 'negative amount'],
      [{ friendName: 'Aarav', amount: 10.001, dueDate: '2026-10-30' }, 'fractional paise'],
      [{ friendName: 'Aarav', amount: 500, dueDate: 'not-a-date' }, 'invalid date'],
    ])('rejects invalid loan input: %s (%s)', async (data) => {
      const token = await signIn();
      await createLoan(token, data as { friendName: string; amount: number; dueDate: string }).expect(422);
    });

    it('prevents another user from reading or repaying a loan', async () => {
      const ownerToken = await signIn('+919876543210');
      const otherToken = await signIn('+919876543211');
      const loan = (await createLoan(ownerToken).expect(201)).body.loan;
      await request(app).get(`/api/loans/${loan.id}`).set('Authorization', `Bearer ${otherToken}`).expect(404);
      await request(app).patch(`/api/loans/${loan.id}/repay`).set('Authorization', `Bearer ${otherToken}`).expect(404);
    });

    it('marks an outstanding loan repaid and consistently rejects a duplicate repayment', async () => {
      const token = await signIn();
      const loan = (await createLoan(token).expect(201)).body.loan;
      const repaid = await request(app).patch(`/api/loans/${loan.id}/repay`).set('Authorization', `Bearer ${token}`).expect(200);
      expect(repaid.body.loan).toMatchObject({ status: 'REPAID', isOverdue: false });
      expect((await request(app).patch(`/api/loans/${loan.id}/repay`).set('Authorization', `Bearer ${token}`).expect(409)).body.error.code).toBe('LOAN_ALREADY_REPAID');
    });

    it('rejects protected requests without authentication', async () => {
      expect((await request(app).get('/api/loans').expect(401)).body.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns safe client errors for malformed JSON and loan IDs', async () => {
      const malformed = await request(app)
        .post('/api/auth/send-otp')
        .set('Content-Type', 'application/json')
        .send('{"phoneNumber":')
        .expect(400);
      expect(malformed.body.error).toEqual({ code: 'MALFORMED_JSON', message: 'The request body contains invalid JSON.' });

      const token = await signIn();
      const invalidId = await request(app).get('/api/loans/not-a-uuid').set('Authorization', `Bearer ${token}`).expect(422);
      expect(invalidId.body.error.code).toBe('VALIDATION_ERROR');
      await request(app).patch('/api/loans/not-a-uuid/repay').set('Authorization', `Bearer ${token}`).expect(422);
    });
  });

  describe('summary calculations', () => {
    it('calculates lent, repaid, outstanding and overdue totals with due-today excluded', async () => {
      const token = await signIn();
      const overdue = (await createLoan(token, { friendName: 'Overdue Friend', amount: 2500, dueDate: '2026-10-21' }).expect(201)).body.loan;
      await createLoan(token, { friendName: 'Due Today', amount: 1500, dueDate: '2026-10-22' }).expect(201);
      const repaid = (await createLoan(token, { friendName: 'Settled Friend', amount: 1000, dueDate: '2026-10-01' }).expect(201)).body.loan;
      await request(app).patch(`/api/loans/${repaid.id}/repay`).set('Authorization', `Bearer ${token}`).expect(200);

      const summary = (await request(app).get('/api/summary').set('Authorization', `Bearer ${token}`).expect(200)).body;
      expect(summary).toEqual({
        currency: 'INR', totalLent: 5000, totalRepaid: 1000, outstandingAmount: 4000,
        overdueAmount: 2500, activeLoanCount: 2, repaidLoanCount: 1, overdueLoanCount: 1,
      });
      expect(summary.totalLent).toBe(summary.totalRepaid + summary.outstandingAmount);
      expect(overdue.isOverdue).toBe(true);
    });

    it('never mixes data between users', async () => {
      const tokenA = await signIn('+919876543210');
      const tokenB = await signIn('+919876543211');
      await createLoan(tokenA, { friendName: 'A Friend', amount: 900, dueDate: '2026-10-20' }).expect(201);
      await createLoan(tokenB, { friendName: 'B Friend', amount: 1200, dueDate: '2026-10-20' }).expect(201);
      const summaryA = (await request(app).get('/api/summary').set('Authorization', `Bearer ${tokenA}`).expect(200)).body;
      const summaryB = (await request(app).get('/api/summary').set('Authorization', `Bearer ${tokenB}`).expect(200)).body;
      expect(summaryA.totalLent).toBe(900);
      expect(summaryB.totalLent).toBe(1200);
    });
  });
});

