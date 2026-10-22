import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../src/config/env.js';

const validProduction = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://app:password@db.example.com:5432/miniledger',
  JWT_SECRET: 'a-production-jwt-secret-with-at-least-32-characters',
  OTP_PEPPER: 'a-production-otp-pepper',
  MOBILE_ORIGIN: 'https://ledger.example.com',
};

afterEach(() => vi.restoreAllMocks());

describe('environment configuration', () => {
  it('refuses placeholder secrets and wildcard CORS in production', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const unsafeValues = [
      { JWT_SECRET: 'replace-with-at-least-32-random-characters' },
      { OTP_PEPPER: 'replace-with-another-long-random-value' },
      { MOBILE_ORIGIN: '*' },
    ];

    for (const unsafe of unsafeValues) {
      expect(() => loadEnv({ ...validProduction, ...unsafe })).toThrow('Invalid environment configuration');
    }
  });

  it('accepts explicit production secrets and a trusted web origin', () => {
    const env = loadEnv(validProduction);

    expect(env.NODE_ENV).toBe('production');
    expect(env.MOBILE_ORIGIN).toBe('https://ledger.example.com');
  });
});
