import { PrismaClient, type Loan as PrismaLoan, type Receipt as PrismaReceipt, type User as PrismaUser } from '@prisma/client';
import type { DataStore, LoanFilters, LoanRecord, OrphanedObjectRecord, ReceiptInput, ReceiptRecord, ReceiptUpsertResult, UserRecord } from './types.js';

function mapUser(user: PrismaUser): UserRecord {
  return user;
}

function mapReceipt(receipt: PrismaReceipt): ReceiptRecord {
  return { id: receipt.id, loanId: receipt.loanId, storageKey: receipt.storageKey, mimeType: receipt.mimeType, byteSize: receipt.byteSize, createdAt: receipt.createdAt };
}

function mapLoan(loan: PrismaLoan & { receipt?: PrismaReceipt | null }): LoanRecord {
  const { receipt, ...rest } = loan;
  return {
    ...rest,
    currency: 'INR',
    dueDate: loan.dueDate.toISOString().slice(0, 10),
    receipt: receipt ? mapReceipt(receipt) : null,
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
      include: { receipt: true },
    });
    return mapLoan(loan);
  }

  async listLoans(userId: string, filters: LoanFilters = {}): Promise<LoanRecord[]> {
    const loans = await this.prisma.loan.findMany({
      where: { userId, ...(filters.status ? { status: filters.status } : {}) },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
      include: { receipt: true },
    });
    return loans.map(mapLoan);
  }

  async findLoan(userId: string, loanId: string): Promise<LoanRecord | null> {
    const loan = await this.prisma.loan.findFirst({ where: { id: loanId, userId }, include: { receipt: true } });
    return loan ? mapLoan(loan) : null;
  }

  async repayLoan(userId: string, loanId: string, repaidAt: Date): Promise<LoanRecord | 'ALREADY_REPAID' | null> {
    return this.prisma.$transaction(async (transaction) => {
      const update = await transaction.loan.updateMany({
        where: { id: loanId, userId, status: 'OUTSTANDING' },
        data: { status: 'REPAID', repaidAt },
      });
      if (update.count === 1) {
        return mapLoan(await transaction.loan.findUniqueOrThrow({ where: { id: loanId }, include: { receipt: true } }));
      }
      const existing = await transaction.loan.findFirst({ where: { id: loanId, userId } });
      if (!existing) return null;
      return 'ALREADY_REPAID';
    });
  }

  async upsertReceipt(loanId: string, input: ReceiptInput): Promise<ReceiptUpsertResult> {
    return this.prisma.$transaction(async (transaction) => {
      const previous = await transaction.receipt.findUnique({ where: { loanId } });
      const record = await transaction.receipt.upsert({
        where: { loanId },
        create: { loanId, ...input },
        update: { storageKey: input.storageKey, mimeType: input.mimeType, byteSize: input.byteSize, createdAt: new Date() },
      });
      return { record: mapReceipt(record), previous: previous ? mapReceipt(previous) : null };
    });
  }

  async findReceiptByLoan(loanId: string): Promise<ReceiptRecord | null> {
    const receipt = await this.prisma.receipt.findUnique({ where: { loanId } });
    return receipt ? mapReceipt(receipt) : null;
  }

  async deleteReceiptByLoan(loanId: string): Promise<ReceiptRecord | null> {
    const receipt = await this.prisma.receipt.findUnique({ where: { loanId } });
    if (!receipt) return null;
    await this.prisma.receipt.delete({ where: { loanId } });
    return mapReceipt(receipt);
  }

  async recordOrphan(storageKey: string, reason: string): Promise<void> {
    await this.prisma.orphanedObject.upsert({
      where: { storageKey },
      create: { storageKey, reason },
      update: { reason, createdAt: new Date() },
    });
  }

  async listOrphans(): Promise<OrphanedObjectRecord[]> {
    return this.prisma.orphanedObject.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async removeOrphanByKey(storageKey: string): Promise<void> {
    await this.prisma.orphanedObject.deleteMany({ where: { storageKey } });
  }
}
