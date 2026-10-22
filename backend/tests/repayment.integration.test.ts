import { execSync } from 'node:child_process';
import os from 'node:os';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaDataStore } from '../src/data/prisma-store.js';
import type { LoanRecord } from '../src/data/types.js';

// Real-PostgreSQL integration test. It runs only when a local server is
// reachable; otherwise it is reported as skipped (NOT RUN) rather than faked.
function postgresAvailable(): boolean {
  try { execSync('pg_isready -h localhost -p 5432', { stdio: 'ignore' }); return true; }
  catch { return false; }
}

const RUN = postgresAvailable();
const suite = RUN ? describe : describe.skip;

suite('concurrent repayment (real PostgreSQL)', () => {
  const dbName = `miniledger_it_${process.pid}`;
  const url = `postgresql://${os.userInfo().username}@localhost:5432/${dbName}`;
  let prisma: PrismaClient;
  let store: PrismaDataStore;

  beforeAll(() => {
    execSync(`createdb ${dbName}`, { stdio: 'ignore' });
    // Apply the real migration history to the disposable database.
    execSync('npx prisma migrate deploy', { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url }, stdio: 'ignore' });
    prisma = new PrismaClient({ datasourceUrl: url });
    store = new PrismaDataStore(prisma);
  }, 60_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    try { execSync(`dropdb --force ${dbName}`, { stdio: 'ignore' }); } catch { /* best effort */ }
  });

  it('lets only one of two concurrent repayments succeed and keeps totals correct', async () => {
    const user = await store.upsertUser('+919876543210');
    const loan = await store.createLoan({ userId: user.id, friendName: 'Concurrent Friend', amountPaise: 250_000, dueDate: '2026-10-20' });
    const when = new Date('2026-10-22T06:30:00.000Z');

    const [a, b] = await Promise.all([
      store.repayLoan(user.id, loan.id, when),
      store.repayLoan(user.id, loan.id, when),
    ]);

    const outcomes = [a, b];
    const succeeded = outcomes.filter((r): r is LoanRecord => r !== null && r !== 'ALREADY_REPAID');
    const conflicts = outcomes.filter((r) => r === 'ALREADY_REPAID');
    expect(succeeded).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
    expect(succeeded[0]!.status).toBe('REPAID');

    const after = await store.findLoan(user.id, loan.id);
    expect(after?.status).toBe('REPAID');
    // Exactly one repayment is reflected: no double-counting.
    const all = await store.listLoans(user.id);
    expect(all.filter((l) => l.status === 'REPAID')).toHaveLength(1);
  });
});
