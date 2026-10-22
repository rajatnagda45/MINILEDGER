import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { AppError } from '../../utils/errors.js';

interface Challenge {
  hash: Buffer;
  expiresAt: number;
  resendAt: number;
  attemptsRemaining: number;
}

interface RequestWindow {
  startedAt: number;
  count: number;
}

export class OtpService {
  private readonly challenges = new Map<string, Challenge>();
  private readonly requestWindows = new Map<string, RequestWindow>();

  constructor(
    private readonly pepper: string,
    private readonly onIssued: (phoneNumber: string, otp: string) => void,
    private readonly now: () => number = Date.now,
  ) {}

  issue(phoneNumber: string): { expiresInSeconds: number; resendInSeconds: number } {
    const time = this.now();
    const current = this.challenges.get(phoneNumber);
    if (current && current.resendAt > time) {
      throw new AppError(429, 'OTP_COOLDOWN', 'Please wait before requesting another code.', {
        retryAfterSeconds: Math.ceil((current.resendAt - time) / 1000),
      });
    }

    const window = this.requestWindows.get(phoneNumber);
    if (!window || time - window.startedAt >= 60 * 60 * 1000) {
      this.requestWindows.set(phoneNumber, { startedAt: time, count: 1 });
    } else {
      if (window.count >= 5) throw new AppError(429, 'OTP_RATE_LIMIT', 'Too many code requests. Try again later.');
      window.count += 1;
    }

    const otp = randomInt(0, 1_000_000).toString().padStart(6, '0');
    this.challenges.set(phoneNumber, {
      hash: this.hash(phoneNumber, otp),
      expiresAt: time + 5 * 60 * 1000,
      resendAt: time + 30 * 1000,
      attemptsRemaining: 5,
    });
    this.onIssued(phoneNumber, otp);
    return { expiresInSeconds: 300, resendInSeconds: 30 };
  }

  verify(phoneNumber: string, otp: string): void {
    const challenge = this.challenges.get(phoneNumber);
    if (!challenge) throw new AppError(400, 'OTP_INVALID', 'That code is invalid or has already been used.');
    if (challenge.expiresAt <= this.now()) {
      this.challenges.delete(phoneNumber);
      throw new AppError(400, 'OTP_EXPIRED', 'That code has expired. Request a new one.');
    }
    if (challenge.attemptsRemaining <= 0) {
      this.challenges.delete(phoneNumber);
      throw new AppError(429, 'OTP_ATTEMPTS_EXCEEDED', 'Too many incorrect attempts. Request a new code.');
    }

    const candidate = this.hash(phoneNumber, otp);
    if (!timingSafeEqual(candidate, challenge.hash)) {
      challenge.attemptsRemaining -= 1;
      throw new AppError(400, 'OTP_INVALID', 'That code is incorrect. Please try again.', {
        attemptsRemaining: challenge.attemptsRemaining,
      });
    }
    this.challenges.delete(phoneNumber);
  }

  private hash(phoneNumber: string, otp: string): Buffer {
    return createHash('sha256').update(`${this.pepper}:${phoneNumber}:${otp}`).digest();
  }
}

