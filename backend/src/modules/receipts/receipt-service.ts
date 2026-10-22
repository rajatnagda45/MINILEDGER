import { z } from 'zod';
import type { DataStore, ReceiptRecord } from '../../data/types.js';
import { AppError } from '../../utils/errors.js';
import { detectImageType } from './image.js';
import type { ReceiptStorage } from './storage.js';

const loanIdSchema = z.string().uuid('Loan ID must be a valid UUID.');

export interface UploadedFile {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname: string;
}

export class ReceiptService {
  constructor(private readonly store: DataStore, private readonly storage: ReceiptStorage) {}

  private async requireOwnedLoan(userId: string, loanId: string): Promise<string> {
    const id = loanIdSchema.parse(loanId);
    const loan = await this.store.findLoan(userId, id);
    if (!loan) throw new AppError(404, 'LOAN_NOT_FOUND', 'Loan not found.');
    return id;
  }

  /**
   * Store and attach (or replace) a receipt. Storage and the database are not a
   * single transaction, so we order operations to stay consistent:
   *   1. Write the new object first (fresh random key — never overwrites).
   *   2. Persist metadata. If that fails, delete the just-written orphan.
   *   3. Only after metadata succeeds, delete the previous object (if replacing),
   *      so a valid attachment always survives a failed replacement.
   */
  async upload(userId: string, loanId: string, file: UploadedFile | undefined): Promise<ReceiptRecord> {
    const id = await this.requireOwnedLoan(userId, loanId);
    if (!file || file.size === 0 || file.buffer.length === 0) {
      throw new AppError(422, 'RECEIPT_REQUIRED', 'Attach a JPEG or PNG image in the "receipt" field.');
    }
    // The declared MIME type and filename are untrusted — verify the bytes.
    const mimeType = detectImageType(file.buffer);
    if (!mimeType) {
      throw new AppError(415, 'RECEIPT_INVALID_TYPE', 'Only JPEG or PNG images are supported.');
    }

    const storageKey = await this.storage.save(file.buffer, mimeType);
    let result;
    try {
      result = await this.store.upsertReceipt(id, { storageKey, mimeType, byteSize: file.buffer.length });
    } catch (error) {
      // Metadata failed: the just-written object is now an orphan. Delete it; if
      // that also fails, record a tombstone so it is never silently lost.
      await this.cleanupOrTombstone(storageKey, 'upload-rollback');
      throw error;
    }
    // Replacement succeeded and points at the new object. Remove the previous
    // object; a failure here is tombstoned (observable + reconcilable) rather
    // than swallowed, and never fails the already-committed replacement.
    if (result.previous && result.previous.storageKey !== storageKey) {
      await this.cleanupOrTombstone(result.previous.storageKey, 'replace-cleanup');
    }
    return result.record;
  }

  async get(userId: string, loanId: string): Promise<{ receipt: ReceiptRecord; bytes: Buffer }> {
    const id = await this.requireOwnedLoan(userId, loanId);
    const receipt = await this.store.findReceiptByLoan(id);
    if (!receipt) throw new AppError(404, 'RECEIPT_NOT_FOUND', 'No receipt is attached to this loan.');
    const bytes = await this.storage.read(receipt.storageKey);
    return { receipt, bytes };
  }

  /**
   * Delete the stored object FIRST, then the metadata. If the object deletion
   * fails we deliberately leave the metadata in place and surface the error, so
   * the receipt stays fully consistent and the caller can safely retry — the API
   * never reports success while a private file is still on disk.
   */
  async remove(userId: string, loanId: string): Promise<void> {
    const id = await this.requireOwnedLoan(userId, loanId);
    const receipt = await this.store.findReceiptByLoan(id);
    if (!receipt) throw new AppError(404, 'RECEIPT_NOT_FOUND', 'No receipt is attached to this loan.');
    await this.storage.delete(receipt.storageKey); // throws on a real failure -> metadata preserved -> retryable
    await this.store.deleteReceiptByLoan(id);
    await this.store.removeOrphanByKey(receipt.storageKey).catch(() => undefined);
  }

  /** Retry deleting any tombstoned orphan objects. Safe to run repeatedly. */
  async reconcileOrphans(): Promise<{ attempted: number; deleted: number; remaining: number }> {
    const orphans = await this.store.listOrphans();
    let deleted = 0;
    for (const orphan of orphans) {
      try {
        await this.storage.delete(orphan.storageKey);
        await this.store.removeOrphanByKey(orphan.storageKey);
        deleted += 1;
      } catch {
        // Leave it tombstoned for the next reconciliation pass.
      }
    }
    return { attempted: orphans.length, deleted, remaining: orphans.length - deleted };
  }

  private async cleanupOrTombstone(storageKey: string, reason: string): Promise<void> {
    try {
      await this.storage.delete(storageKey);
      await this.store.removeOrphanByKey(storageKey).catch(() => undefined);
    } catch {
      await this.store.recordOrphan(storageKey, reason).catch(() => undefined);
      // Observable without leaking contents: only the opaque key and reason.
      console.error(`[receipt] cleanup failed, tombstoned for reconciliation: ${storageKey} (${reason})`);
    }
  }
}
