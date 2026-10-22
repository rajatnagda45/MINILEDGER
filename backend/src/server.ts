import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { PrismaDataStore } from './data/prisma-store.js';
import { ReceiptService } from './modules/receipts/receipt-service.js';
import { LocalReceiptStorage } from './modules/receipts/storage.js';

config({ path: resolve(process.cwd(), '../.env') });
const env = loadEnv();
const prisma = new PrismaClient();
const store = new PrismaDataStore(prisma);
const app = createApp({ env, store });

// Best-effort: retry cleaning up any receipt objects whose deletion failed
// previously (recorded as tombstones). Non-blocking and safe to run repeatedly.
void new ReceiptService(store, new LocalReceiptStorage(env.RECEIPT_STORAGE_DIR))
  .reconcileOrphans()
  .then((result) => { if (result.attempted) console.info(`[receipt] reconciled ${result.deleted}/${result.attempted} orphan object(s)`); })
  .catch(() => undefined);
const server = app.listen(env.PORT, () => {
  console.info(`MiniLedger API listening on http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  console.info(`${signal} received, shutting down.`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

