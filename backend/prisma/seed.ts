import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const phoneNumber = '+919999999999';

async function main() {
  const user = await prisma.user.upsert({ where: { phoneNumber }, update: {}, create: { phoneNumber } });
  const count = await prisma.loan.count({ where: { userId: user.id } });
  if (count === 0) {
    await prisma.loan.createMany({
      data: [
        { userId: user.id, friendName: 'Aarav Sharma', amountPaise: 250000, dueDate: new Date('2026-10-18T00:00:00.000Z') },
        { userId: user.id, friendName: 'Meera Iyer', amountPaise: 180000, dueDate: new Date('2026-10-30T00:00:00.000Z') },
        { userId: user.id, friendName: 'Kabir Khan', amountPaise: 95000, dueDate: new Date('2026-10-10T00:00:00.000Z'), status: 'REPAID', repaidAt: new Date('2026-10-08T10:30:00.000Z') },
      ],
    });
  }
  console.info(`Seeded demo account ${phoneNumber}`);
}

main().finally(() => prisma.$disconnect());

