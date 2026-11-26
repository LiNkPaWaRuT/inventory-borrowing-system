import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server/src/app.js';
import { prisma } from '../server/src/prisma.js';

describe('Feature F02: Item Catalog, Request, and Custodian Checkout Workflow', () => {
  let borrower1Token: string;
  let borrower2Token: string;
  let custodianToken: string;
  let availableItem: { id: string; title: string; serialNumber: string; isAvailable: boolean };
  let unavailableItem: { id: string; title: string; serialNumber: string; isAvailable: boolean };

  beforeAll(async () => {
    await prisma.$connect();

    // 1. Authenticate Borrower 1
    const b1Res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'borrower1@example.com', password: 'Password123!' });
    borrower1Token = b1Res.body.token;

    // 2. Authenticate Borrower 2
    const b2Res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'borrower2@example.com', password: 'Password123!' });
    borrower2Token = b2Res.body.token;

    // 3. Authenticate Custodian
    const cRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'custodian@example.com', password: 'Password123!' });
    custodianToken = cRes.body.token;

    const unavailable = await prisma.item.findUnique({
      where: { serialNumber: 'LA-2026-003' }
    });
    if (unavailable) {
      unavailableItem = unavailable;
    }

    const available = await prisma.item.findUnique({
      where: { serialNumber: 'OSC-2026-001' }
    });
    if (available) {
      availableItem = available;
    }
  });

  beforeEach(async () => {
    // Reset loans and item states before each test so each starts with a clean quota state
    await prisma.loan.deleteMany({});
    await prisma.item.updateMany({
      where: { serialNumber: { in: ['OSC-2026-001', 'RPI-2026-002'] } },
      data: { isAvailable: true }
    });
    if (unavailableItem) {
      await prisma.item.update({
        where: { id: unavailableItem.id },
        data: { isAvailable: false }
      });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // AC-07: Borrower can view catalog of items with live isAvailable status
  it('AC-07: should list catalog of items with availability flags', async () => {
    const res = await request(app)
      .get('/api/items')
      .set('Authorization', `Bearer ${borrower1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items[0]).toHaveProperty('isAvailable');
  });

  // TEST-LOAN-01 / AC-08: Borrower requests available item -> 201 Created and persisted
  it('TEST-LOAN-01: Borrower requests available item -> 201 Created and persisted (AC-08)', async () => {
    const res = await request(app)
      .post('/api/loans/request')
      .set('Authorization', `Bearer ${borrower1Token}`)
      .send({ itemId: availableItem.id });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.loan).toBeDefined();
    expect(res.body.loan.status).toBe('REQUESTED');
    expect(res.body.loan.itemId).toBe(availableItem.id);

    // Verify persistence in DB
    const persisted = await prisma.loan.findUnique({
      where: { id: res.body.loan.id }
    });
    expect(persisted).not.toBeNull();
    expect(persisted?.status).toBe('REQUESTED');
  });

  // TEST-LOAN-02 / AC-09, AC-10 (BR-01, BR-02): Request unavailable item -> 409 Conflict
  it('TEST-LOAN-02: Request unavailable item -> 409 Conflict (AC-09, AC-10 / BR-01, BR-02)', async () => {
    // Attempt to borrow an already unavailable item
    const res = await request(app)
      .post('/api/loans/request')
      .set('Authorization', `Bearer ${borrower1Token}`)
      .send({ itemId: unavailableItem.id });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ITEM_UNAVAILABLE');
  });

  // TEST-LOAN-03 / AC-12: Custodian checks out requested loan -> Loan is ACTIVE, Item is unavailable
  it('TEST-LOAN-03: Custodian checks out requested loan -> Loan is ACTIVE, Item is unavailable (AC-12)', async () => {
    // 1. Create a fresh available item for a clean checkout flow
    const uniqueSuffix = Math.random().toString(36).substring(2, 9);
    const testItem = await prisma.item.create({
      data: {
        title: 'Digital Multimeter DMM6500',
        serialNumber: `DMM-TEST-${uniqueSuffix}`,
        category: 'Electronics Lab',
        isAvailable: true
      }
    });

    // 2. Borrower requests item
    const reqRes = await request(app)
      .post('/api/loans/request')
      .set('Authorization', `Bearer ${borrower1Token}`)
      .send({ itemId: testItem.id });

    expect(reqRes.status).toBe(201);
    const loanId = reqRes.body.loan.id;

    // 3. Custodian approves checkout
    const checkoutRes = await request(app)
      .post(`/api/loans/${loanId}/checkout`)
      .set('Authorization', `Bearer ${custodianToken}`);

    expect(checkoutRes.status).toBe(200);
    expect(checkoutRes.body.success).toBe(true);
    expect(checkoutRes.body.loan.status).toBe('ACTIVE');

    // 4. Verify item is now unavailable
    const updatedItem = await prisma.item.findUnique({ where: { id: testItem.id } });
    expect(updatedItem?.isAvailable).toBe(false);
  });

  // TEST-LOAN-04 / AC-05, BR-03: Borrower attempting checkout returns 403 Forbidden
  it('TEST-LOAN-04: Borrower attempting checkout returns 403 Forbidden (AC-05 / BR-03)', async () => {
    // 1. Borrower creates a request
    const uniqueSuffix = Math.random().toString(36).substring(2, 9);
    const testItem = await prisma.item.create({
      data: {
        title: 'Soldering Station WT1010',
        serialNumber: `SOL-TEST-${uniqueSuffix}`,
        category: 'Electronics Lab',
        isAvailable: true
      }
    });

    const reqRes = await request(app)
      .post('/api/loans/request')
      .set('Authorization', `Bearer ${borrower1Token}`)
      .send({ itemId: testItem.id });

    const loanId = reqRes.body.loan.id;

    // 2. Borrower attempts checkout approval -> must return 403
    const checkoutRes = await request(app)
      .post(`/api/loans/${loanId}/checkout`)
      .set('Authorization', `Bearer ${borrower1Token}`);

    expect(checkoutRes.status).toBe(403);
    expect(checkoutRes.body.success).toBe(false);
    expect(checkoutRes.body.error.code).toBe('AUTH_FORBIDDEN');
  });

  // TEST-LOAN-05 / AC-11, BR-04: Borrower inspecting another user's loan returns 403 Forbidden
  it("TEST-LOAN-05: Borrower inspecting another user's loan returns 403 Forbidden (AC-11 / BR-04)", async () => {
    // Borrower 1 creates a loan
    const uniqueSuffix = Math.random().toString(36).substring(2, 9);
    const testItem = await prisma.item.create({
      data: {
        title: 'Function Generator DG4102',
        serialNumber: `FG-TEST-${uniqueSuffix}`,
        category: 'Electronics Lab',
        isAvailable: true
      }
    });

    const reqRes = await request(app)
      .post('/api/loans/request')
      .set('Authorization', `Bearer ${borrower1Token}`)
      .send({ itemId: testItem.id });

    const borrower1LoanId = reqRes.body.loan.id;

    // Borrower 2 attempts to inspect Borrower 1's loan
    const getRes = await request(app)
      .get(`/api/loans/${borrower1LoanId}`)
      .set('Authorization', `Bearer ${borrower2Token}`);

    expect(getRes.status).toBe(403);
    expect(getRes.body.success).toBe(false);
    expect(getRes.body.error.code).toBe('FORBIDDEN_LOAN_ACCESS');
  });

  // Borrower views personal loans
  it('should return only borrower personal loans at /api/loans/my-loans', async () => {
    const res = await request(app)
      .get('/api/loans/my-loans')
      .set('Authorization', `Bearer ${borrower1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.loans)).toBe(true);
  });

  // Custodian views all loan requests
  it('should return all loans for Custodian at /api/custodian/loans', async () => {
    const res = await request(app)
      .get('/api/custodian/loans')
      .set('Authorization', `Bearer ${custodianToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.loans)).toBe(true);
  });

  // DEF-01 Regression Test: Distinguish PENDING / REQUESTED status from ACTIVE checkout in item catalog
  it('TEST-DEF-01: should return catalog status distinguishing REQUESTED items from Checked Out (RED phase)', async () => {
    // 1. Create a fresh available item
    const pendingItem = await prisma.item.create({
      data: {
        title: 'Signal Generator SG-100',
        serialNumber: `SG-${Date.now()}`,
        category: 'Electronics Lab',
        isAvailable: true
      }
    });

    // 2. Borrower requests loan (loan status = REQUESTED)
    await request(app)
      .post('/api/loans/request')
      .set('Authorization', `Bearer ${borrower1Token}`)
      .send({ itemId: pendingItem.id });

    // 3. Fetch item catalog
    const catalogRes = await request(app)
      .get('/api/items')
      .set('Authorization', `Bearer ${borrower1Token}`);

    expect(catalogRes.status).toBe(200);
    const targetItem = catalogRes.body.items.find((i: any) => i.id === pendingItem.id);

    // Reproduce DEF-01: Expect item to have a distinct catalogStatus = 'PENDING_APPROVAL' or status = 'REQUESTED'
    // This will FAIL on current implementation because /api/items does not yet provide catalogStatus
    expect(targetItem.catalogStatus).toBe('PENDING_APPROVAL');
  });

  // TEST-L7-01: Boundary Verification for Borrower 2-Loan Quota (BR-04, AC-13, AC-14)
  it('TEST-L7-01: should allow up to 2 concurrent loans (REQUESTED or ACTIVE) and reject 3rd request with 409 LOAN_LIMIT_EXCEEDED (RED phase)', async () => {
    // 1. Precondition: Ensure borrower2 starts with 0 active/pending loans
    const b2User = await prisma.user.findUnique({ where: { email: 'borrower2@example.com' } });
    expect(b2User).not.toBeNull();
    await prisma.loan.deleteMany({ where: { borrowerId: b2User!.id } });

    // 2. Precondition: Create 3 distinct available hardware items
    const itemA = await prisma.item.create({
      data: {
        title: 'FPGA Cyclone IV Dev Kit',
        serialNumber: `FPGA-${Date.now()}-A`,
        category: 'Digital Systems',
        isAvailable: true
      }
    });
    const itemB = await prisma.item.create({
      data: {
        title: 'ARM Cortex-M4 Kit',
        serialNumber: `ARM-${Date.now()}-B`,
        category: 'Embedded Systems',
        isAvailable: true
      }
    });
    const itemC = await prisma.item.create({
      data: {
        title: 'HackRF One SDR Transceiver',
        serialNumber: `SDR-${Date.now()}-C`,
        category: 'RF & Wireless',
        isAvailable: true
      }
    });

    // Step 1: 1st borrow request (Boundary count: 0 -> 1) -> Must succeed with 201 Created (AC-13)
    const res1 = await request(app)
      .post('/api/loans/request')
      .set('Authorization', `Bearer ${borrower2Token}`)
      .send({ itemId: itemA.id });

    expect(res1.status).toBe(201);
    expect(res1.body.success).toBe(true);
    expect(res1.body.loan.status).toBe('REQUESTED');

    // Step 2: 2nd borrow request (Boundary count: 1 -> 2) -> Must succeed with 201 Created (AC-13)
    const res2 = await request(app)
      .post('/api/loans/request')
      .set('Authorization', `Bearer ${borrower2Token}`)
      .send({ itemId: itemB.id });

    expect(res2.status).toBe(201);
    expect(res2.body.success).toBe(true);
    expect(res2.body.loan.status).toBe('REQUESTED');

    // Step 3: 3rd borrow request (Boundary exceeded: 2 -> 3) -> Must reject with 409 Conflict (AC-14)
    const res3 = await request(app)
      .post('/api/loans/request')
      .set('Authorization', `Bearer ${borrower2Token}`)
      .send({ itemId: itemC.id });

    // Under pre-change code (6a19bd1 / f26e202), this will FAIL (RED) because no quota check exists (returns 201)
    expect(res3.status).toBe(409);
    expect(res3.body.error).toBe('LOAN_LIMIT_EXCEEDED');
    expect(res3.body.message).toContain('limit of 2 concurrent loans');

    // Step 4: Verify state integrity - Item C has no persisted loan record
    const itemCLoan = await prisma.loan.findFirst({
      where: { itemId: itemC.id }
    });
    expect(itemCLoan).toBeNull();

    // Verify borrower2 holds exactly 2 active/pending loans in database
    const b2Loans = await prisma.loan.findMany({
      where: {
        borrowerId: b2User!.id,
        status: { in: ['REQUESTED', 'ACTIVE'] }
      }
    });
    expect(b2Loans.length).toBe(2);
  });
});
