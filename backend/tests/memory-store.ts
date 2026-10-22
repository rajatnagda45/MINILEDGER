import { randomUUID } from 'node:crypto';
import type { DataStore, LoanFilters, LoanRecord, UserRecord } from '../src/data/types.js';

export class MemoryStore implements DataStore {
  readonly users: UserRecord[] = [];
  readonly loans: LoanRecord[] = [];

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
      receiptPath: null,
      repaidAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.loans.push(loan);
    return loan;
  }

  async listLoans(userId: string, filters: LoanFilters = {}): Promise<LoanRecord[]> {
    return this.loans
      .filter((loan) => loan.userId === userId && (!filters.status || loan.status === filters.status))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  async findLoan(userId: string, loanId: string): Promise<LoanRecord | null> {
    return this.loans.find((loan) => loan.id === loanId && loan.userId === userId) ?? null;
  }

  async repayLoan(userId: string, loanId: string, repaidAt: Date): Promise<LoanRecord | 'ALREADY_REPAID' | null> {
    const loan = await this.findLoan(userId, loanId);
    if (!loan) return null;
    if (loan.status === 'REPAID') return 'ALREADY_REPAID';
    loan.status = 'REPAID';
    loan.repaidAt = repaidAt;
    loan.updatedAt = repaidAt;
    return loan;
  }
}

