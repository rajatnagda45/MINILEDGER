import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalReceiptStorage } from '../src/modules/receipts/storage.js';

const POSIX = process.platform !== 'win32';
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 9)]);

describe('LocalReceiptStorage', () => {
  let dir: string;
  let storage: LocalReceiptStorage;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'ml-receipts-'));
    storage = new LocalReceiptStorage(dir);
  });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('round-trips save, read, and delete', async () => {
    const key = await storage.save(PNG, 'image/png');
    expect(key).toMatch(/^[0-9a-f-]+\.png$/);
    expect(Buffer.compare(await storage.read(key), PNG)).toBe(0);
    await storage.delete(key);
    await expect(storage.read(key)).rejects.toThrow();
  });

  it('creates a private directory (0700) and private files (0600)', async () => {
    const key = await storage.save(PNG, 'image/png');
    if (!POSIX) { expect(key).toBeTruthy(); return; } // modes are not meaningful on Windows
    expect((await stat(dir)).mode & 0o777).toBe(0o700);
    expect((await stat(path.join(dir, key)).then((s) => s.mode & 0o777))).toBe(0o600);
  });

  it('rejects path traversal in a storage key', async () => {
    await expect(storage.read('../../../etc/passwd')).rejects.toMatchObject({ code: 'RECEIPT_INVALID_KEY' });
    await expect(storage.delete('../escape.png')).rejects.toMatchObject({ code: 'RECEIPT_INVALID_KEY' });
  });

  it('delete is idempotent for an already-removed key', async () => {
    const key = await storage.save(PNG, 'image/png');
    await storage.delete(key);
    await expect(storage.delete(key)).resolves.toBeUndefined();
  });
});
