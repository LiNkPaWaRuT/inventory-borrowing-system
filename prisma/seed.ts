import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with reproducible test accounts and items...');

  // Clean old records
  await prisma.loan.deleteMany({});
  await prisma.item.deleteMany({});
  await prisma.user.deleteMany({});

  const defaultPassword = await bcrypt.hash('Password123!', 10);

  // 1 Custodian
  const custodian = await prisma.user.create({
    data: {
      email: 'custodian@example.com',
      name: 'Bob Custodian',
      passwordHash: defaultPassword,
      role: 'CUSTODIAN'
    }
  });

  // 2 Borrowers
  const borrower1 = await prisma.user.create({
    data: {
      email: 'borrower1@example.com',
      name: 'Alice Borrower',
      passwordHash: defaultPassword,
      role: 'BORROWER'
    }
  });

  const borrower2 = await prisma.user.create({
    data: {
      email: 'borrower2@example.com',
      name: 'Charlie Borrower',
      passwordHash: defaultPassword,
      role: 'BORROWER'
    }
  });

  // 3 Inventory items (2 available, 1 checked out)
  const item1 = await prisma.item.create({
    data: {
      title: 'Digital Oscilloscope DS1054Z',
      serialNumber: 'OSC-2026-001',
      category: 'Electronics Lab',
      isAvailable: true
    }
  });

  const item2 = await prisma.item.create({
    data: {
      title: 'Raspberry Pi 4 Model B (8GB)',
      serialNumber: 'RPI-2026-002',
      category: 'Embedded Systems',
      isAvailable: true
    }
  });

  const item3 = await prisma.item.create({
    data: {
      title: 'Logic Analyzer 16 Channel',
      serialNumber: 'LA-2026-003',
      category: 'Electronics Lab',
      isAvailable: false
    }
  });

  // Create an active loan for item 3 (checked out to borrower2)
  await prisma.loan.create({
    data: {
      itemId: item3.id,
      borrowerId: borrower2.id,
      status: 'ACTIVE',
      checkedOutAt: new Date()
    }
  });

  console.log('Seed completed successfully:');
  console.log(`- Custodian: ${custodian.email}`);
  console.log(`- Borrower 1: ${borrower1.email}`);
  console.log(`- Borrower 2: ${borrower2.email}`);
  console.log(`- Items: 2 available, 1 checked out.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
