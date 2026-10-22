export type StoredLoanStatus = 'OUTSTANDING' | 'REPAID';

export interface UserRecord {
  id: string;
  phoneNumber: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReceiptRecord {
  id: string;
  loanId: string;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  createdAt: Date;
}

export interface OrphanedObjectRecord {
  id: string;
  storageKey: string;
  reason: string;
  createdAt: Date;
}

export interface LoanRecord {
  id: string;
  userId: string;
  friendName: string;
  amountPaise: number;
  currency: 'INR';
  dueDate: string;
  status: StoredLoanStatus;
  receipt: ReceiptRecord | null;
  repaidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoanFilters {
  status?: StoredLoanStatus;
}

export interface ReceiptInput {
  storageKey: string;
  mimeType: string;
  byteSize: number;
}

/** Result of an upsert: the current record plus any record it replaced, so the
 *  caller can delete the now-orphaned previous object only after success. */
export interface ReceiptUpsertResult {
  record: ReceiptRecord;
  previous: ReceiptRecord | null;
}

export interface DataStore {
  upsertUser(phoneNumber: string): Promise<UserRecord>;
  findUserById(id: string): Promise<UserRecord | null>;
  createLoan(input: { userId: string; friendName: string; amountPaise: number; dueDate: string }): Promise<LoanRecord>;
  listLoans(userId: string, filters?: LoanFilters): Promise<LoanRecord[]>;
  findLoan(userId: string, loanId: string): Promise<LoanRecord | null>;
  repayLoan(userId: string, loanId: string, repaidAt: Date): Promise<LoanRecord | 'ALREADY_REPAID' | null>;
  // Receipts. Ownership is enforced by the caller via findLoan before these run.
  upsertReceipt(loanId: string, input: ReceiptInput): Promise<ReceiptUpsertResult>;
  findReceiptByLoan(loanId: string): Promise<ReceiptRecord | null>;
  deleteReceiptByLoan(loanId: string): Promise<ReceiptRecord | null>;
  // Orphaned storage objects awaiting retryable cleanup (idempotent by key).
  recordOrphan(storageKey: string, reason: string): Promise<void>;
  listOrphans(): Promise<OrphanedObjectRecord[]>;
  removeOrphanByKey(storageKey: string): Promise<void>;
}
