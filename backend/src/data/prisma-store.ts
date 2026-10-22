import { PrismaClient, type Loan as PrismaLoan, type User as PrismaUser } from '@prisma/client';
import type { DataStore, LoanFilters, LoanRecord, UserRecord } from './types.js';

function mapUser(user: PrismaUser): UserRecord {
  return user;
}

function mapLoan(loan: PrismaLoan): LoanRecord {
  return {
    ...loan,
    currency: 'INR',
    dueDate: loan.dueDate.toISOString().slice(0, 10),
  };
}

export class PrismaDataStore implements DataStore {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertUser(phoneNumber: string): Promise<UserRecord> {
    return mapUser(await this.prisma.user.upsert({
      where: { phoneNumber },
      create: { phoneNumber },
      update: {},
    }));
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? mapUser(user) : null;
  }

  async createLoan(input: { userId: string; friendName: string; amountPaise: number; dueDate: string }): Promise<LoanRecord> {
    const loan = await this.prisma.loan.create({
      data: {
        userId: input.userId,
        friendName: input.friendName,
        amountPaise: input.amountPaise,
        dueDate: new Date(`${input.dueDate}T00:00:00.000Z`),
      },
    });
    return mapLoan(loan);
  }

  async listLoans(userId: string, filters: LoanFilters = {}): Promise<LoanRecord[]> {
    const loans = await this.prisma.loan.findMany({
      where: { userId, ...(filters.status ? { status: filters.status } : {}) },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });
    return loans.map(mapLoan);
  }

  async findLoan(userId: string, loanId: string): Promise<LoanRecord | null> {
    const loan = await this.prisma.loan.findFirst({ where: { id: loanId, userId } });
    return loan ? mapLoan(loan) : null;
  }

  async repayLoan(userId: string, loanId: string, repaidAt: Date): Promise<LoanRecord | 'ALREADY_REPAID' | null> {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.loan.findFirst({ where: { id: loanId, userId } });
      if (!existing) return null;
      if (existing.status === 'REPAID') return 'ALREADY_REPAID';
      return mapLoan(await transaction.loan.update({
        where: { id: loanId },
        data: { status: 'REPAID', repaidAt },
      }));
    });
  }
}

