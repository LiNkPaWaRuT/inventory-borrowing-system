import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

    // Fetch items from seed
    const items = await prisma.item.findMany();
    const available = items.find((i) => i.isAvailable);
    const unavailable = items.find((i) => !i.isAvailable);

    if (!available || !unavailable) {
      throw new Error('Seed data missing available or unavailable items');
    }

    availableItem = available;
    unavailableItem = unavailable;
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
    const testItem = await prisma.item.create({
      data: {
        title: 'Digital Multimeter DMM6500',
        serialNumber: `DMM-TEST-${Date.now()}`,
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
    const testItem = await prisma.item.create({
      data: {
        title: 'Soldering Station WT1010',
        serialNumber: `SOL-TEST-${Date.now()}`,
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
    const testItem = await prisma.item.create({
      data: {
        title: 'Function Generator DG4102',
        serialNumber: `FG-TEST-${Date.now()}`,
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
});
