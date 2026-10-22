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
      await this.storage.delete(storageKey).catch(() => undefined);
      throw error;
    }
    if (result.previous && result.previous.storageKey !== storageKey) {
      await this.storage.delete(result.previous.storageKey).catch(() => undefined);
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

  async remove(userId: string, loanId: string): Promise<void> {
    const id = await this.requireOwnedLoan(userId, loanId);
    const receipt = await this.store.deleteReceiptByLoan(id);
    if (!receipt) throw new AppError(404, 'RECEIPT_NOT_FOUND', 'No receipt is attached to this loan.');
    await this.storage.delete(receipt.storageKey).catch(() => undefined);
  }
}
