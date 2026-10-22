export type StoredLoanStatus = 'OUTSTANDING' | 'REPAID';

export interface UserRecord {
  id: string;
  phoneNumber: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoanRecord {
  id: string;
  userId: string;
  friendName: string;
  amountPaise: number;
  currency: 'INR';
  dueDate: string;
  status: StoredLoanStatus;
  receiptPath: string | null;
  repaidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoanFilters {
  status?: StoredLoanStatus;
}

export interface DataStore {
  upsertUser(phoneNumber: string): Promise<UserRecord>;
  findUserById(id: string): Promise<UserRecord | null>;
  createLoan(input: { userId: string; friendName: string; amountPaise: number; dueDate: string }): Promise<LoanRecord>;
  listLoans(userId: string, filters?: LoanFilters): Promise<LoanRecord[]>;
  findLoan(userId: string, loanId: string): Promise<LoanRecord | null>;
  repayLoan(userId: string, loanId: string, repaidAt: Date): Promise<LoanRecord | 'ALREADY_REPAID' | null>;
}

