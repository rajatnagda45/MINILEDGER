import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
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
  RECEIPT_STORAGE_DIR: '.receipts-test',
  RECEIPT_MAX_BYTES: 5 * 1024 * 1024,
};
const CLAIMS = { issuer: 'miniledger-api', audience: 'miniledger-mobile' } as const;

describe('auth security', () => {
  let app: Express;
  let store: MemoryStore;
  let now: Date;
  let issued: Map<string, string>;
  const advance = (ms: number) => { now = new Date(now.valueOf() + ms); };

  beforeEach(() => {
    store = new MemoryStore();
    now = new Date('2026-10-22T06:30:00.000Z');
    issued = new Map();
    app = createApp({ env, store, now: () => now, onOtpIssued: (p, o) => issued.set(p, o), disableRateLimit: true });
  });

  const send = (phoneNumber: string) => request(app).post('/api/auth/send-otp').send({ phoneNumber });
  const verify = (phoneNumber: string, otp: string) => request(app).post('/api/auth/verify-otp').send({ phoneNumber, otp });

  describe('OTP boundaries', () => {
    it('enforces the 30-second resend cooldown', async () => {
      const phone = '+919876543210';
      await send(phone).expect(202);
      expect((await send(phone).expect(429)).body.error.code).toBe('OTP_COOLDOWN');
      advance(30_000);
      await send(phone).expect(202);
    });

    it('enforces the hourly issuance limit (5 per hour)', async () => {
      const phone = '+919876543210';
      for (let i = 0; i < 5; i += 1) { await send(phone).expect(202); advance(31_000); }
      expect((await send(phone).expect(429)).body.error.code).toBe('OTP_RATE_LIMIT');
    });

    it('exhausts verification attempts after five wrong codes', async () => {
      const phone = '+919876543210';
      await send(phone).expect(202);
      const wrong = issued.get(phone) === '000000' ? '111111' : '000000';
      for (let i = 0; i < 5; i += 1) expect((await verify(phone, wrong).expect(400)).body.error.code).toBe('OTP_INVALID');
      expect((await verify(phone, wrong).expect(429)).body.error.code).toBe('OTP_ATTEMPTS_EXCEEDED');
    });

    it('rejects an expired code and a reused code', async () => {
      const phone = '+919876543210';
      await send(phone).expect(202);
      const code = issued.get(phone)!;
      advance(301_000);
      expect((await verify(phone, code).expect(400)).body.error.code).toBe('OTP_EXPIRED');

      const second = '+919876543211';
      await send(second).expect(202);
      const code2 = issued.get(second)!;
      await verify(second, code2).expect(200);
      expect((await verify(second, code2).expect(400)).body.error.code).toBe('OTP_INVALID');
    });
  });

  describe('JWT verification is strict', () => {
    async function signInUser() {
      const phone = '+919876543210';
      await send(phone).expect(202);
      const token = (await verify(phone, issued.get(phone)!).expect(200)).body.token as string;
      const sub = (jwt.decode(token) as { sub: string }).sub;
      return { token, sub, phoneNumber: phone };
    }
    const callLoans = (token: string) => request(app).get('/api/loans').set('Authorization', `Bearer ${token}`);

    it('accepts a correctly signed token', async () => {
      const { token } = await signInUser();
      await callLoans(token).expect(200);
    });

    it('rejects an unexpected signing algorithm', async () => {
      const { sub, phoneNumber } = await signInUser();
      const hs512 = jwt.sign({ sub, phoneNumber }, env.JWT_SECRET, { algorithm: 'HS512', ...CLAIMS });
      expect((await callLoans(hs512).expect(401)).body.error.code).toBe('SESSION_EXPIRED');
    });

    it('rejects an alg:none token', async () => {
      const { sub, phoneNumber } = await signInUser();
      const none = jwt.sign({ sub, phoneNumber }, '', { algorithm: 'none', ...CLAIMS });
      await callLoans(none).expect(401);
    });

    it('rejects an invalid signature', async () => {
      const { sub, phoneNumber } = await signInUser();
      const badSig = jwt.sign({ sub, phoneNumber }, 'a-different-secret-that-is-at-least-32-chars', { algorithm: 'HS256', ...CLAIMS });
      await callLoans(badSig).expect(401);
    });

    it('rejects an expired token', async () => {
      const { sub, phoneNumber } = await signInUser();
      const expired = jwt.sign({ sub, phoneNumber }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: -10, ...CLAIMS });
      await callLoans(expired).expect(401);
    });

    it('rejects wrong issuer or audience', async () => {
      const { sub, phoneNumber } = await signInUser();
      const wrongIss = jwt.sign({ sub, phoneNumber }, env.JWT_SECRET, { algorithm: 'HS256', issuer: 'evil', audience: CLAIMS.audience });
      const wrongAud = jwt.sign({ sub, phoneNumber }, env.JWT_SECRET, { algorithm: 'HS256', issuer: CLAIMS.issuer, audience: 'evil' });
      await callLoans(wrongIss).expect(401);
      await callLoans(wrongAud).expect(401);
    });
  });

  describe('auth rate limiter', () => {
    it('limits bursts of auth requests from one client', async () => {
      const limited = createApp({ env, store, now: () => now, onOtpIssued: (p, o) => issued.set(p, o), disableRateLimit: false });
      let sawLimit = false;
      for (let i = 0; i < 31; i += 1) {
        // distinct valid numbers avoid the per-phone OTP limit; the IP limiter (30/window) trips.
        const phone = `+9198765${String(10000 + i).padStart(5, '0')}`;
        const res = await request(limited).post('/api/auth/send-otp').send({ phoneNumber: phone });
        if (res.status === 429) { sawLimit = true; break; }
      }
      expect(sawLimit).toBe(true);
    });
  });
});
