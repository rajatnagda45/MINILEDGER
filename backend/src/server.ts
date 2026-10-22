import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { PrismaDataStore } from './data/prisma-store.js';

config({ path: resolve(process.cwd(), '../.env') });
const env = loadEnv();
const prisma = new PrismaClient();
const app = createApp({ env, store: new PrismaDataStore(prisma) });
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

