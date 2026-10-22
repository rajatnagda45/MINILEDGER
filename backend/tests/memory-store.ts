import { randomUUID } from 'node:crypto';
import type { DataStore, LoanFilters, LoanRecord, OrphanedObjectRecord, ReceiptInput, ReceiptRecord, ReceiptUpsertResult, UserRecord } from '../src/data/types.js';

export class MemoryStore implements DataStore {
  readonly users: UserRecord[] = [];
  readonly loans: LoanRecord[] = [];
  readonly receipts = new Map<string, ReceiptRecord>();
  readonly orphans = new Map<string, OrphanedObjectRecord>();

  private withReceipt(loan: LoanRecord): LoanRecord {
    return { ...loan, receipt: this.receipts.get(loan.id) ?? null };
  }

  async upsertUser(phoneNumber: string): Promise<UserRecord> {
    const existing = this.users.find((user) => user.phoneNumber === phoneNumber);
    if (existing) return existing;
    const now = new Date();
    const user = { id: randomUUID(), phoneNumber, createdAt: now, updatedAt: now };
    this.users.push(user);
    return user;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async createLoan(input: { userId: string; friendName: string; amountPaise: number; dueDate: string }): Promise<LoanRecord> {
    const now = new Date();
    const loan: LoanRecord = {
      id: randomUUID(),
      userId: input.userId,
      friendName: input.friendName,
      amountPaise: input.amountPaise,
      dueDate: input.dueDate,
      currency: 'INR',
      status: 'OUTSTANDING',
      receipt: null,
      repaidAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.loans.push(loan);
    return this.withReceipt(loan);
  }

  async listLoans(userId: string, filters: LoanFilters = {}): Promise<LoanRecord[]> {
    return this.loans
      .filter((loan) => loan.userId === userId && (!filters.status || loan.status === filters.status))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((loan) => this.withReceipt(loan));
  }

  async findLoan(userId: string, loanId: string): Promise<LoanRecord | null> {
    const loan = this.loans.find((item) => item.id === loanId && item.userId === userId);
    return loan ? this.withReceipt(loan) : null;
  }

  async repayLoan(userId: string, loanId: string, repaidAt: Date): Promise<LoanRecord | 'ALREADY_REPAID' | null> {
    const loan = this.loans.find((item) => item.id === loanId && item.userId === userId);
    if (!loan) return null;
    if (loan.status === 'REPAID') return 'ALREADY_REPAID';
    loan.status = 'REPAID';
    loan.repaidAt = repaidAt;
    loan.updatedAt = repaidAt;
    return this.withReceipt(loan);
  }

  async upsertReceipt(loanId: string, input: ReceiptInput): Promise<ReceiptUpsertResult> {
    const previous = this.receipts.get(loanId) ?? null;
    const record: ReceiptRecord = { id: previous?.id ?? randomUUID(), loanId, ...input, createdAt: new Date() };
    this.receipts.set(loanId, record);
    return { record, previous };
  }

  async findReceiptByLoan(loanId: string): Promise<ReceiptRecord | null> {
    return this.receipts.get(loanId) ?? null;
  }

  async deleteReceiptByLoan(loanId: string): Promise<ReceiptRecord | null> {
    const receipt = this.receipts.get(loanId) ?? null;
    if (receipt) this.receipts.delete(loanId);
    return receipt;
  }

  async recordOrphan(storageKey: string, reason: string): Promise<void> {
    this.orphans.set(storageKey, { id: this.orphans.get(storageKey)?.id ?? randomUUID(), storageKey, reason, createdAt: new Date() });
  }

  async listOrphans(): Promise<OrphanedObjectRecord[]> {
    return [...this.orphans.values()].sort((a, b) => a.createdAt.valueOf() - b.createdAt.valueOf());
  }

  async removeOrphanByKey(storageKey: string): Promise<void> {
    this.orphans.delete(storageKey);
  }
}
