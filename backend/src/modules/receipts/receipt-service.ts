import { z } from 'zod';
import type { DataStore, ReceiptRecord } from '../../data/types.js';
import { AppError } from '../../utils/errors.js';
import { inspectImage } from './image.js';
import type { ReceiptStorage } from './storage.js';

const loanIdSchema = z.string().uuid('Loan ID must be a valid UUID.');

export interface UploadedFile {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname: string;
}

export class ReceiptService {
  private readonly replacementQueues = new Map<string, Promise<void>>();

  constructor(private readonly store: DataStore, private readonly storage: ReceiptStorage) {}

  /** Serialize metadata replacement and cleanup for one loan within this API
   * process. New objects may be written concurrently, but each replacement then
   * observes the actual preceding record and cleans up exactly that object. */
  private async serializeReplacement<T>(loanId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.replacementQueues.get(loanId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    this.replacementQueues.set(loanId, current);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.replacementQueues.get(loanId) === current) this.replacementQueues.delete(loanId);
    }
  }

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
    // The declared MIME type and filename are untrusted — inspect the bytes.
    const inspection = inspectImage(file.buffer);
    if (!inspection.ok) {
      if (inspection.code === 'UNSUPPORTED') {
        throw new AppError(415, 'RECEIPT_INVALID_TYPE', 'Only JPEG or PNG images are supported.');
      }
      if (inspection.code === 'DIMENSIONS') {
        throw new AppError(422, 'RECEIPT_INVALID_IMAGE', 'The image dimensions are outside the supported range.');
      }
      throw new AppError(422, 'RECEIPT_INVALID_IMAGE', 'The image is truncated or malformed.');
    }
    const { mimeType } = inspection;

    const storageKey = await this.storage.save(file.buffer, mimeType);
    return this.serializeReplacement(id, async () => {
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
    });
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
    const removed = await this.store.deleteReceiptByLoanIfMatches(id, receipt.storageKey);
    if (!removed) {
      const current = await this.store.findReceiptByLoan(id);
      if (current) {
        // A concurrent replacement won after this request read the old receipt.
        // Never delete that newer metadata; ask the caller to refresh instead.
        throw new AppError(409, 'RECEIPT_CHANGED', 'The receipt changed while it was being removed. Refresh and try again.');
      }
      // A concurrent delete already removed the same metadata. The requested
      // end state is satisfied, so removal remains idempotently successful.
    }
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
      try {
        await this.store.recordOrphan(storageKey, reason);
        // Observable without leaking contents: only the opaque key and reason.
        console.error(`[receipt] cleanup failed, tombstoned for reconciliation: ${storageKey} (${reason})`);
      } catch {
        // Do not claim a tombstone exists when the recovery metadata could not
        // be persisted (for example during a database outage).
        console.error(`[receipt] cleanup failed and tombstone persistence failed: ${storageKey} (${reason})`);
      }
    }
  }
}
