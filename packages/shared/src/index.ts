export type LoanStatus = 'OUTSTANDING' | 'REPAID';

export interface Loan {
  id: string;
  friendName: string;
  amount: number;
  currency: 'INR';
  dueDate: string;
  status: LoanStatus;
  isOverdue: boolean;
  receiptAvailable: boolean;
  createdAt: string;
  updatedAt: string;
  repaidAt: string | null;
}

export interface Summary {
  currency: 'INR';
  totalLent: number;
  totalRepaid: number;
  outstandingAmount: number;
  overdueAmount: number;
  activeLoanCount: number;
  repaidLoanCount: number;
  overdueLoanCount: number;
}

export interface AuthSession {
  token: string;
  user: { id: string; phoneNumber: string };
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

