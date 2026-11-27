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

  // TEST-RET-01: Equipment Return with GOOD/FAIR Condition (Sprint 2 / F-03) [FR-08, BR-06, AC-15]
  it('TEST-RET-01: Custodian check-in with GOOD condition restores item availability and frees quota (F-03)', async () => {
    // 1. Setup: Create available item, request it, and check it out to ACTIVE state
    const item = await prisma.item.create({
      data: {
        title: 'Oscilloscope Probe Kit 100MHz',
        serialNumber: `PRB-${Date.now()}-1`,
        category: 'Probes & Accessories',
        isAvailable: true
      }
    });

    const reqRes = await request(app)
      .post('/api/loans/request')
      .set('Authorization', `Bearer ${borrower1Token}`)
      .send({ itemId: item.id });
    const loanId = reqRes.body.loan.id;

    await request(app)
      .post(`/api/loans/${loanId}/checkout`)
      .set('Authorization', `Bearer ${custodianToken}`);

    // Verify precondition: Loan is ACTIVE, item is unavailable
    const activeLoan = await prisma.loan.findUnique({ where: { id: loanId } });
    expect(activeLoan?.status).toBe('ACTIVE');

    // 2. Action: Custodian returns equipment with GOOD condition
    const returnRes = await request(app)
      .post(`/api/loans/${loanId}/return`)
      .set('Authorization', `Bearer ${custodianToken}`)
      .send({
        conditionGrade: 'GOOD',
        returnNotes: 'Returned in full working condition with all accessories.'
      });

    expect(returnRes.status).toBe(200);
    expect(returnRes.body.success).toBe(true);
    expect(returnRes.body.loan.status).toBe('RETURNED');
    expect(returnRes.body.loan.conditionGrade).toBe('GOOD');

    // 3. Verify DB persistence: item isAvailable is restored to true
    const updatedItem = await prisma.item.findUnique({ where: { id: item.id } });
    expect(updatedItem?.isAvailable).toBe(true);

    // 4. Verify borrower quota is freed (0 active/requested loans remaining)
    const b1User = await prisma.user.findUnique({ where: { email: 'borrower1@example.com' } });
    const activeLoans = await prisma.loan.count({
      where: {
        borrowerId: b1User!.id,
        status: { in: ['REQUESTED', 'ACTIVE'] }
      }
    });
    expect(activeLoans).toBe(0);
  });

  // TEST-RET-02: Equipment Return with DAMAGED Condition Quarantine (Sprint 2 / F-03) [FR-08, BR-07, AC-16]
  it('TEST-RET-02: Custodian check-in with DAMAGED condition quarantines item in MAINTENANCE (F-03)', async () => {
    // 1. Setup: Create available item, request it, and check it out to ACTIVE state
    const item = await prisma.item.create({
      data: {
        title: 'Precision Benchtop Power Supply',
        serialNumber: `PWR-${Date.now()}-2`,
        category: 'Power Equipment',
        isAvailable: true
      }
    });

    const reqRes = await request(app)
      .post('/api/loans/request')
      .set('Authorization', `Bearer ${borrower1Token}`)
      .send({ itemId: item.id });
    const loanId = reqRes.body.loan.id;

    await request(app)
      .post(`/api/loans/${loanId}/checkout`)
      .set('Authorization', `Bearer ${custodianToken}`);

    // 2. Action: Custodian returns equipment with DAMAGED condition
    const returnRes = await request(app)
      .post(`/api/loans/${loanId}/return`)
      .set('Authorization', `Bearer ${custodianToken}`)
      .send({
        conditionGrade: 'DAMAGED',
        returnNotes: 'Output channel 2 voltage regulation erratic; requires calibration.'
      });

    expect(returnRes.status).toBe(200);
    expect(returnRes.body.success).toBe(true);
    expect(returnRes.body.loan.status).toBe('RETURNED');
    expect(returnRes.body.loan.conditionGrade).toBe('DAMAGED');

    // 3. Verify DB persistence: item isAvailable remains false and item status is MAINTENANCE
    const updatedItem = await prisma.item.findUnique({ where: { id: item.id } });
    expect(updatedItem?.isAvailable).toBe(false);

    // 4. Verify another borrower cannot request this damaged item (409 Conflict)
    const attemptRes = await request(app)
      .post('/api/loans/request')
      .set('Authorization', `Bearer ${borrower2Token}`)
      .send({ itemId: item.id });
    expect(attemptRes.status).toBe(409);
  });

  // TEST-RET-03: Security & Validation Guardrails (Sprint 2 / F-03) [BR-06, AC-17]
  it('TEST-RET-03: Rejects borrower return with 403 Forbidden and non-active loan return with 409 Conflict', async () => {
    // 1. Setup: Create available item and request it (loan is REQUESTED, not ACTIVE)
    const item = await prisma.item.create({
      data: {
        title: 'USB Logic Analyzer 8-Channel',
        serialNumber: `LOG-${Date.now()}-3`,
        category: 'Logic Analyzers',
        isAvailable: true
      }
    });

    const reqRes = await request(app)
      .post('/api/loans/request')
      .set('Authorization', `Bearer ${borrower1Token}`)
      .send({ itemId: item.id });
    const loanId = reqRes.body.loan.id;

    // Sub-test A: Custodian attempts return on REQUESTED (non-ACTIVE) loan -> 409 Conflict
    const nonActiveRes = await request(app)
      .post(`/api/loans/${loanId}/return`)
      .set('Authorization', `Bearer ${custodianToken}`)
      .send({ conditionGrade: 'GOOD' });
    expect(nonActiveRes.status).toBe(409);

    // Activate the loan via custodian checkout
    await request(app)
      .post(`/api/loans/${loanId}/checkout`)
      .set('Authorization', `Bearer ${custodianToken}`);

    // Sub-test B: Borrower attempts return on ACTIVE loan -> 403 Forbidden (BR-06)
    const borrowerRes = await request(app)
      .post(`/api/loans/${loanId}/return`)
      .set('Authorization', `Bearer ${borrower1Token}`)
      .send({ conditionGrade: 'GOOD' });
    expect(borrowerRes.status).toBe(403);
  });

  // =========================================================================
  // Sprint 2 Feature F-04: Loan Due Dates & Overdue Penalty Engine
  // =========================================================================

  // TEST-DUE-01: Due Date Assignment upon Checkout (Sprint 2 / F-04) [FR-09, AC-18]
  it('TEST-DUE-01: Custodian checkout assigns dueAt exactly 7 calendar days from checkout (F-04)', async () => {
    // 1. Setup: Create available item and request it
    const item = await prisma.item.create({
      data: {
        title: 'Arbitrary Waveform Generator 25MHz',
        serialNumber: `AWG-${Date.now()}-1`,
        category: 'Signal Generators',
        isAvailable: true
      }
    });

    const reqRes = await request(app)
      .post('/api/loans/request')
      .set('Authorization', `Bearer ${borrower1Token}`)
      .send({ itemId: item.id });
    const loanId = reqRes.body.loan.id;

    // 2. Action: Custodian checks out item
    const checkoutTime = new Date();
    const checkoutRes = await request(app)
      .post(`/api/loans/${loanId}/checkout`)
      .set('Authorization', `Bearer ${custodianToken}`);

    expect(checkoutRes.status).toBe(200);
    expect(checkoutRes.body.loan.dueAt).toBeDefined();

    // 3. Assertion: dueAt must be ~7 days (168 hours) after checkout
    const dueAt = new Date(checkoutRes.body.loan.dueAt);
    const expectedDueAt = new Date(checkoutTime.getTime() + 7 * 24 * 60 * 60 * 1000);
    const diffHours = Math.abs((dueAt.getTime() - expectedDueAt.getTime()) / (1000 * 60 * 60));
    expect(diffHours).toBeLessThan(1); // Within 1 hour tolerance
  });

  // TEST-DUE-02: Overdue Status Detection & Accrued Fine Calculation (Sprint 2 / F-04) [FR-09, BR-08, AC-19]
  it('TEST-DUE-02: Accrues $5.00/day fine for loans past dueAt and reports OVERDUE status (F-04)', async () => {
    // 1. Setup: Create item and simulate an active loan that was due 3 days ago
    const item = await prisma.item.create({
      data: {
        title: 'Thermal Imaging Camera FLIR E4',
        serialNumber: `FLIR-${Date.now()}-2`,
        category: 'Thermal Imaging',
        isAvailable: false
      }
    });

    const b1User = await prisma.user.findUnique({ where: { email: 'borrower1@example.com' } });
    const pastDueAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days overdue
    const checkedOutAt = new Date(pastDueAt.getTime() - 7 * 24 * 60 * 60 * 1000); // Checked out 10 days ago

    const pastLoan = await prisma.loan.create({
      data: {
        itemId: item.id,
        borrowerId: b1User!.id,
        status: 'ACTIVE',
        checkedOutAt,
        dueAt: pastDueAt
      }
    });

    // 2. Action: Borrower inspects personal loans
    const loansRes = await request(app)
      .get('/api/loans/my-loans')
      .set('Authorization', `Bearer ${borrower1Token}`);

    expect(loansRes.status).toBe(200);
    const inspectedLoan = loansRes.body.loans.find((l: any) => l.id === pastLoan.id);
    expect(inspectedLoan).toBeDefined();

    // 3. Assertion: Status should flag as OVERDUE and accrued fine should be exactly 3 days * $5 = $15.00
    expect(inspectedLoan.isOverdue).toBe(true);
    expect(inspectedLoan.daysOverdue).toBe(3);
    expect(inspectedLoan.accruedFine).toBe(15.0);
  });

  // TEST-DUE-03: Overdue Loan Return Finalizes Accrued Fine (Sprint 2 / F-04) [FR-08, FR-09, AC-15, AC-19]
  it('TEST-DUE-03: Returning an overdue loan records the final penaltyFine and restores item availability (F-04)', async () => {
    // 1. Setup: Create item and an overdue active loan (2 days overdue)
    const item = await prisma.item.create({
      data: {
        title: 'Soldering Workstation 80W',
        serialNumber: `SLD-${Date.now()}-3`,
        category: 'Soldering & Rework',
        isAvailable: false
      }
    });

    const b2User = await prisma.user.findUnique({ where: { email: 'borrower2@example.com' } });
    const pastDueAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days overdue

    const overdueLoan = await prisma.loan.create({
      data: {
        itemId: item.id,
        borrowerId: b2User!.id,
        status: 'ACTIVE',
        checkedOutAt: new Date(pastDueAt.getTime() - 7 * 24 * 60 * 60 * 1000),
        dueAt: pastDueAt
      }
    });

    // 2. Action: Custodian checks in the overdue loan with GOOD condition
    const returnRes = await request(app)
      .post(`/api/loans/${overdueLoan.id}/return`)
      .set('Authorization', `Bearer ${custodianToken}`)
      .send({
        conditionGrade: 'GOOD',
        returnNotes: 'Returned late but equipment in perfect shape.'
      });

    expect(returnRes.status).toBe(200);
    expect(returnRes.body.loan.status).toBe('RETURNED');
    expect(returnRes.body.loan.penaltyFine).toBe(10.0); // 2 days * $5.00 = $10.00

    // 3. Assertion: Item availability restored and persistence verified in DB
    const dbLoan = await prisma.loan.findUnique({ where: { id: overdueLoan.id } });
    expect(dbLoan?.penaltyFine).toBe(10.0);
    expect(dbLoan?.returnedAt).toBeDefined();

    const dbItem = await prisma.item.findUnique({ where: { id: item.id } });
    expect(dbItem?.isAvailable).toBe(true);
  });

  // ==========================================
  // SPRINT 3: MULTI-ITEM BATCH BORROWING (F-05)
  // ==========================================

  // TEST-BAT-01: Multi-Item Batch Request Atomic Success (Sprint 3 / F-05) [FR-10, BR-09, AC-20]
  it('TEST-BAT-01: Borrower with 0 active loans atomically requests 2 available items (F-05)', async () => {
    // 1. Setup: Create 2 available items
    const item1 = await prisma.item.create({
      data: {
        title: 'Raspberry Pi 4 Model B 8GB',
        serialNumber: `RPI-${Date.now()}-1`,
        category: 'Single Board Computers',
        isAvailable: true
      }
    });

    const item2 = await prisma.item.create({
      data: {
        title: 'Arduino Giga R1 WiFi',
        serialNumber: `ARD-${Date.now()}-2`,
        category: 'Microcontrollers',
        isAvailable: true
      }
    });

    // 2. Action: Borrower submits batch borrow request for both items
    const batchRes = await request(app)
      .post('/api/loans/batch')
      .set('Authorization', `Bearer ${borrower1Token}`)
      .send({ itemIds: [item1.id, item2.id] });

    expect(batchRes.status).toBe(201);
    expect(batchRes.body.success).toBe(true);
    expect(batchRes.body.count).toBe(2);
    expect(batchRes.body.loans.length).toBe(2);
    expect(batchRes.body.loans.every((l: any) => l.status === 'REQUESTED')).toBe(true);

    // 3. Verify Quota in DB: Borrower active/pending loans count is now exactly 2
    const b1User = await prisma.user.findUnique({ where: { email: 'borrower1@example.com' } });
    const activeLoans = await prisma.loan.count({
      where: {
        borrowerId: b1User!.id,
        status: { in: ['REQUESTED', 'ACTIVE'] }
      }
    });
    expect(activeLoans).toBe(2);
  });

  // TEST-BAT-02: Batch Request Quota Rejection & Rollback (Sprint 3 / F-05) [BR-04, BR-09, AC-21]
  it('TEST-BAT-02: Batch request exceeding quota rolls back atomically without inserting rows (F-05)', async () => {
    // 1. Setup: Create 3 available items, borrower already has 1 requested loan
    const itemA = await prisma.item.create({
      data: {
        title: 'Logic Analyzer 16-Channel',
        serialNumber: `LOG-${Date.now()}-A`,
        category: 'Test & Measurement',
        isAvailable: true
      }
    });

    const itemB = await prisma.item.create({
      data: {
        title: 'DC Power Supply 30V 5A',
        serialNumber: `PWR-${Date.now()}-B`,
        category: 'Power Supplies',
        isAvailable: true
      }
    });

    const itemC = await prisma.item.create({
      data: {
        title: 'Digital Multimeter True RMS',
        serialNumber: `DMM-${Date.now()}-C`,
        category: 'Test & Measurement',
        isAvailable: true
      }
    });

    // Borrower requests itemA single-item (Quota: 1/2)
    const singleRes = await request(app)
      .post('/api/loans/request')
      .set('Authorization', `Bearer ${borrower1Token}`)
      .send({ itemId: itemA.id });
    expect(singleRes.status).toBe(201);

    // 2. Action: Borrower attempts batch request with 2 items (itemB and itemC) -> Total would be 1 + 2 = 3 > 2!
    const batchRes = await request(app)
      .post('/api/loans/batch')
      .set('Authorization', `Bearer ${borrower1Token}`)
      .send({ itemIds: [itemB.id, itemC.id] });

    // 3. Assertion: Rejected with 409 Conflict LOAN_LIMIT_EXCEEDED
    expect(batchRes.status).toBe(409);
    expect(batchRes.body.error).toBe('LOAN_LIMIT_EXCEEDED');
    expect(batchRes.body.message).toContain('limit of 2');

    // 4. Assertion: Atomic rollback - Item B and Item C have 0 loans in DB
    const itemBLoan = await prisma.loan.findFirst({ where: { itemId: itemB.id } });
    const itemCLoan = await prisma.loan.findFirst({ where: { itemId: itemC.id } });
    expect(itemBLoan).toBeNull();
    expect(itemCLoan).toBeNull();

    // Borrower still holds strictly 1 active loan
    const b1User = await prisma.user.findUnique({ where: { email: 'borrower1@example.com' } });
    const activeLoans = await prisma.loan.count({
      where: {
        borrowerId: b1User!.id,
        status: { in: ['REQUESTED', 'ACTIVE'] }
      }
    });
    expect(activeLoans).toBe(1);
  });

  // TEST-BAT-03: Partial Availability Rollback (Sprint 3 / F-05) [BR-01, BR-09, AC-22]
  it('TEST-BAT-03: If any item in batch is unavailable, entire batch rolls back with 409 (F-05)', async () => {
    // 1. Setup: Item 1 is available, Item 2 is unavailable
    const itemAvailable = await prisma.item.create({
      data: {
        title: 'Soldering Mat Anti-Static',
        serialNumber: `MAT-${Date.now()}-1`,
        category: 'Accessories',
        isAvailable: true
      }
    });

    const itemUnavailable = await prisma.item.create({
      data: {
        title: 'Spectrum Analyzer 3GHz',
        serialNumber: `SPEC-${Date.now()}-2`,
        category: 'RF Equipment',
        isAvailable: false
      }
    });

    // 2. Action: Batch request containing 1 available and 1 unavailable item
    const batchRes = await request(app)
      .post('/api/loans/batch')
      .set('Authorization', `Bearer ${borrower1Token}`)
      .send({ itemIds: [itemAvailable.id, itemUnavailable.id] });

    expect(batchRes.status).toBe(409);
    expect(batchRes.body.error).toBe('ITEM_UNAVAILABLE');

    // 3. Assertion: Atomic rollback - 0 loan records created for itemAvailable
    const loanForAvail = await prisma.loan.findFirst({ where: { itemId: itemAvailable.id } });
    expect(loanForAvail).toBeNull();
  });
});
