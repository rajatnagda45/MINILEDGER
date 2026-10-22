import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  OTP_PEPPER: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('7d'),
  APP_TIME_ZONE: z.string().default('Asia/Kolkata'),
  MOBILE_ORIGIN: z.string().default('*'),
  // Receipts: a private directory (never statically served) and a max upload size.
  RECEIPT_STORAGE_DIR: z.string().default('.receipts'),
  RECEIPT_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
}).superRefine((env, context) => {
  if (env.NODE_ENV !== 'production') return;

  if (env.JWT_SECRET.startsWith('replace-with-')) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_SECRET'], message: 'Production JWT_SECRET must not use the example placeholder.' });
  }
  if (env.OTP_PEPPER.startsWith('replace-with-')) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['OTP_PEPPER'], message: 'Production OTP_PEPPER must not use the example placeholder.' });
  }
  if (env.MOBILE_ORIGIN.trim() === '*') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['MOBILE_ORIGIN'], message: 'Production MOBILE_ORIGIN must be an explicit trusted origin.' });
  }
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    console.error('Invalid environment configuration', result.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  return result.data;
}

