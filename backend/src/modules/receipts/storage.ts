import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../../utils/errors.js';
import type { ReceiptMimeType } from './image.js';

// Least-privilege modes. POSIX permission bits are meaningful on Unix; on
// Windows they are advisory, so mode assertions/enforcement are skipped there.
const DIR_MODE = 0o700;
const FILE_MODE = 0o600;
const POSIX = process.platform !== 'win32';

/**
 * Storage abstraction for receipt binaries. The database only ever holds
 * metadata (a server-generated storage key); the bytes live behind this
 * interface. A future deployment can back it with private Amazon S3 without
 * touching callers — see README "Receipts" for the S3 extension notes.
 */
export interface ReceiptStorage {
  /** Persist bytes and return an opaque, server-generated storage key. */
  save(bytes: Buffer, mimeType: ReceiptMimeType): Promise<string>;
  read(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
}

const EXTENSIONS: Record<ReceiptMimeType, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' };

/**
 * Local filesystem implementation for development and tests. Files are written
 * to a private directory that is never statically served. Keys are random
 * UUIDs (we never trust the uploaded filename as a path), and writes use
 * exclusive creation so an existing object can never be silently overwritten.
 */
export class LocalReceiptStorage implements ReceiptStorage {
  private readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir);
  }

  private resolveKey(storageKey: string): string {
    // storageKey is server-generated, but validate anyway to defend against
    // any future caller passing attacker-controlled input (path traversal).
    const full = path.resolve(this.baseDir, storageKey);
    if (full !== this.baseDir && !full.startsWith(this.baseDir + path.sep)) {
      throw new AppError(400, 'RECEIPT_INVALID_KEY', 'Invalid receipt reference.');
    }
    return full;
  }

  private async ensureDir(): Promise<void> {
    await mkdir(this.baseDir, { recursive: true, mode: DIR_MODE });
    // mode on mkdir only applies when creating; tighten an existing looser dir.
    if (POSIX) await chmod(this.baseDir, DIR_MODE);
  }

  async save(bytes: Buffer, mimeType: ReceiptMimeType): Promise<string> {
    await this.ensureDir();
    const storageKey = `${randomUUID()}.${EXTENSIONS[mimeType]}`;
    const full = this.resolveKey(storageKey);
    // 'wx' (O_EXCL) fails if the path already exists and does not follow a
    // symlink at that path — no accidental overwrites or symlink following.
    // `mode` makes the new file owner-only (0600) on creation.
    await writeFile(full, bytes, { flag: 'wx', mode: FILE_MODE });
    if (POSIX) await chmod(full, FILE_MODE);
    return storageKey;
  }

  async read(storageKey: string): Promise<Buffer> {
    return readFile(this.resolveKey(storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    await rm(this.resolveKey(storageKey), { force: true });
  }
}
