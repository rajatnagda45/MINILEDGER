import { z } from 'zod';
import type { Loan } from '@miniledger/shared';
import type { DataStore, LoanRecord, StoredLoanStatus } from '../../data/types.js';
import { isOverdue, isValidIsoDate, todayInTimeZone } from '../../utils/date.js';
import { AppError } from '../../utils/errors.js';
import { paiseToRupees, rupeesToPaise } from '../../utils/money.js';

const createLoanSchema = z.object({
  friendName: z.string().trim().min(2, 'Enter at least two characters.').max(80),
  amount: z.number().positive(),
  dueDate: z.string().refine(isValidIsoDate, 'Use a valid date in YYYY-MM-DD format.'),
}).strict();

const statusSchema = z.enum(['OUTSTANDING', 'REPAID']);

export class LoanService {
  constructor(
    private readonly store: DataStore,
    private readonly timeZone: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(userId: string, input: unknown): Promise<Loan> {
    const data = createLoanSchema.parse(input);
    const loan = await this.store.createLoan({
      userId,
      friendName: data.friendName,
      amountPaise: rupeesToPaise(data.amount),
      dueDate: data.dueDate,
    });
    return this.serialize(loan);
  }

  async list(userId: string, rawStatus?: unknown): Promise<Loan[]> {
    const status = rawStatus === undefined ? undefined : statusSchema.parse(rawStatus);
    const filters: { status?: StoredLoanStatus } = {};
    if (status) filters.status = status;
    const loans = await this.store.listLoans(userId, filters);
    return loans.map((loan) => this.serialize(loan));
  }

  async get(userId: string, loanId: string): Promise<Loan> {
    const loan = await this.store.findLoan(userId, loanId);
    if (!loan) throw new AppError(404, 'LOAN_NOT_FOUND', 'Loan not found.');
    return this.serialize(loan);
  }

  async repay(userId: string, loanId: string): Promise<Loan> {
    const result = await this.store.repayLoan(userId, loanId, this.now());
    if (!result) throw new AppError(404, 'LOAN_NOT_FOUND', 'Loan not found.');
    if (result === 'ALREADY_REPAID') throw new AppError(409, 'LOAN_ALREADY_REPAID', 'This loan is already marked as repaid.');
    return this.serialize(result);
  }

  async summary(userId: string) {
    const loans = await this.store.listLoans(userId);
    const today = todayInTimeZone(this.timeZone, this.now());
    const values = loans.reduce((summary, loan) => {
      summary.totalLent += loan.amountPaise;
      if (loan.status === 'REPAID') {
        summary.totalRepaid += loan.amountPaise;
        summary.repaidLoanCount += 1;
      } else {
        summary.outstandingAmount += loan.amountPaise;
        summary.activeLoanCount += 1;
        if (isOverdue(loan.dueDate, loan.status, today)) {
          summary.overdueAmount += loan.amountPaise;
          summary.overdueLoanCount += 1;
        }
      }
      return summary;
    }, {
      totalLent: 0,
      totalRepaid: 0,
      outstandingAmount: 0,
      overdueAmount: 0,
      activeLoanCount: 0,
      repaidLoanCount: 0,
      overdueLoanCount: 0,
    });
    return {
      currency: 'INR' as const,
      ...values,
      totalLent: paiseToRupees(values.totalLent),
      totalRepaid: paiseToRupees(values.totalRepaid),
      outstandingAmount: paiseToRupees(values.outstandingAmount),
      overdueAmount: paiseToRupees(values.overdueAmount),
    };
  }

  private serialize(loan: LoanRecord): Loan {
    const today = todayInTimeZone(this.timeZone, this.now());
    return {
      id: loan.id,
      friendName: loan.friendName,
      amount: paiseToRupees(loan.amountPaise),
      currency: 'INR',
      dueDate: loan.dueDate,
      status: loan.status,
      isOverdue: isOverdue(loan.dueDate, loan.status, today),
      receiptAvailable: Boolean(loan.receiptPath),
      createdAt: loan.createdAt.toISOString(),
      updatedAt: loan.updatedAt.toISOString(),
      repaidAt: loan.repaidAt?.toISOString() ?? null,
    };
  }
}

