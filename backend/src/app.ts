import cors from 'cors';
import express, { type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import multer from 'multer';
import type { Env } from './config/env.js';
import type { DataStore } from './data/types.js';
import { authenticate } from './middleware/authenticate.js';
import { AuthService } from './modules/auth/auth.js';
import { OtpService } from './modules/auth/otp-service.js';
import { LoanService } from './modules/loans/loan-service.js';
import { ReceiptService } from './modules/receipts/receipt-service.js';
import { LocalReceiptStorage, type ReceiptStorage } from './modules/receipts/storage.js';
import { errorHandler, notFound } from './utils/errors.js';

interface AppOptions {
  env: Env;
  store: DataStore;
  storage?: ReceiptStorage;
  now?: () => Date;
  onOtpIssued?: (phoneNumber: string, otp: string) => void;
  disableRateLimit?: boolean;
}

function asyncRoute(handler: RequestHandler): RequestHandler {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

function routeId(value: string | string[]): string {
  return Array.isArray(value) ? value[0]! : value;
}

export function createApp(options: AppOptions) {
  const app = express();
  const otp = new OtpService(
    options.env.OTP_PEPPER,
    options.onOtpIssued ?? (options.env.NODE_ENV === 'production'
      ? () => undefined
      : (phone, code) => console.info(`[DEV OTP] ${phone}: ${code}`)),
    options.now ? () => options.now!().valueOf() : Date.now,
  );
  const auth = new AuthService(options.store, otp, options.env);
  const loans = new LoanService(options.store, options.env.APP_TIME_ZONE, options.now);
  const storage = options.storage ?? new LocalReceiptStorage(options.env.RECEIPT_STORAGE_DIR);
  const receipts = new ReceiptService(options.store, storage);
  const uploadReceipt = multer({ storage: multer.memoryStorage(), limits: { fileSize: options.env.RECEIPT_MAX_BYTES, files: 1 } }).single('receipt');
  const requireAuth = authenticate(auth);

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: options.env.MOBILE_ORIGIN === '*' ? true : options.env.MOBILE_ORIGIN }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
  if (!options.disableRateLimit) app.use('/api/auth', authLimiter);

  app.post('/api/auth/send-otp', asyncRoute(async (request, response) => {
    response.status(202).json(auth.sendOtp(request.body));
  }));
  app.post('/api/auth/verify-otp', asyncRoute(async (request, response) => {
    response.json(await auth.verifyOtp(request.body));
  }));

  app.get('/api/loans', requireAuth, asyncRoute(async (request, response) => {
    response.json({ loans: await loans.list(request.auth!.userId, request.query.status) });
  }));
  app.get('/api/loans/:id', requireAuth, asyncRoute(async (request, response) => {
    response.json({ loan: await loans.get(request.auth!.userId, routeId(request.params.id!)) });
  }));
  app.post('/api/loans', requireAuth, asyncRoute(async (request, response) => {
    response.status(201).json({ loan: await loans.create(request.auth!.userId, request.body) });
  }));
  app.patch('/api/loans/:id/repay', requireAuth, asyncRoute(async (request, response) => {
    response.json({ loan: await loans.repay(request.auth!.userId, routeId(request.params.id!)) });
  }));
  app.get('/api/summary', requireAuth, asyncRoute(async (request, response) => {
    response.json(await loans.summary(request.auth!.userId));
  }));

  app.post('/api/loans/:id/receipt', requireAuth, uploadReceipt, asyncRoute(async (request, response) => {
    const loanId = routeId(request.params.id!);
    await receipts.upload(request.auth!.userId, loanId, request.file);
    response.status(201).json({ loan: await loans.get(request.auth!.userId, loanId) });
  }));
  app.get('/api/loans/:id/receipt', requireAuth, asyncRoute(async (request, response) => {
    const { receipt, bytes } = await receipts.get(request.auth!.userId, routeId(request.params.id!));
    response.setHeader('Content-Type', receipt.mimeType);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Disposition', 'inline');
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(bytes);
  }));
  app.delete('/api/loans/:id/receipt', requireAuth, asyncRoute(async (request, response) => {
    await receipts.remove(request.auth!.userId, routeId(request.params.id!));
    response.status(204).send();
  }));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

