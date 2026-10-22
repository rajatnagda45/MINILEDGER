import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { Env } from '../../config/env.js';
import type { DataStore } from '../../data/types.js';
import { AppError } from '../../utils/errors.js';
import type { OtpService } from './otp-service.js';

export const phoneSchema = z.string().trim().transform((value) => {
  const digits = value.replace(/[^\d+]/g, '');
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return digits;
}).refine((value) => /^\+91[6-9]\d{9}$/.test(value), 'Enter a valid Indian mobile number.');

const sendOtpSchema = z.object({ phoneNumber: phoneSchema });
const verifyOtpSchema = z.object({ phoneNumber: phoneSchema, otp: z.string().regex(/^\d{6}$/, 'Enter the six-digit code.') });

export class AuthService {
  constructor(
    private readonly store: DataStore,
    private readonly otp: OtpService,
    private readonly env: Env,
  ) {}

  sendOtp(input: unknown) {
    const { phoneNumber } = sendOtpSchema.parse(input);
    return { phoneNumber, ...this.otp.issue(phoneNumber) };
  }

  async verifyOtp(input: unknown) {
    const { phoneNumber, otp } = verifyOtpSchema.parse(input);
    this.otp.verify(phoneNumber, otp);
    const user = await this.store.upsertUser(phoneNumber);
    const token = jwt.sign({ sub: user.id, phoneNumber: user.phoneNumber }, this.env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: this.env.JWT_EXPIRES_IN as NonNullable<jwt.SignOptions['expiresIn']>,
      issuer: 'miniledger-api',
      audience: 'miniledger-mobile',
    });
    return { token, user: { id: user.id, phoneNumber: user.phoneNumber } };
  }

  async authenticate(header: string | undefined): Promise<{ userId: string; phoneNumber: string }> {
    if (!header?.startsWith('Bearer ')) throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
    try {
      const payload = jwt.verify(header.slice(7), this.env.JWT_SECRET, {
        algorithms: ['HS256'], // pin the algorithm: reject alg:none and algorithm-confusion attempts
        issuer: 'miniledger-api',
        audience: 'miniledger-mobile',
      });
      if (typeof payload === 'string' || !payload.sub || typeof payload.phoneNumber !== 'string') throw new Error('Invalid payload');
      const user = await this.store.findUserById(payload.sub);
      if (!user) throw new Error('Unknown user');
      return { userId: user.id, phoneNumber: user.phoneNumber };
    } catch {
      throw new AppError(401, 'SESSION_EXPIRED', 'Your session has expired. Please sign in again.');
    }
  }
}

