import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server/src/app.js';
import { prisma } from '../server/src/prisma.js';

describe('Feature F01: Authentication & Role-Based Access Control', () => {
  beforeAll(async () => {
    // Ensure database is connected
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // TEST-AUTH-01 / AC-01: Valid login returns JWT and user identity
  it('TEST-AUTH-01: should login successfully with valid borrower credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'borrower1@example.com',
        password: 'Password123!'
      });

    // Intentionally broken assertion for Check C-02: prove branch protection gate blocks failing PR
    expect(res.status).toBe(999);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toMatchObject({
      email: 'borrower1@example.com',
      role: 'BORROWER'
    });
  });

  // TEST-AUTH-02 / AC-02: Invalid password returns 401
  it('TEST-AUTH-02: should reject login with invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'borrower1@example.com',
        password: 'WrongPassword999!'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  // TEST-AUTH-03 / AC-04: Protected endpoint rejects unauthenticated requests
  it('TEST-AUTH-03: should reject unauthenticated request to /api/auth/me', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_UNAUTHORIZED');
  });

  // TEST-AUTH-04 / AC-05: Borrower token cannot access custodian-only routes
  it('TEST-AUTH-04: should return 403 Forbidden when Borrower calls Custodian endpoint', async () => {
    // 1. Login as Borrower
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'borrower1@example.com',
        password: 'Password123!'
      });

    const borrowerToken = loginRes.body.token;

    // 2. Attempt custodian operation
    const res = await request(app)
      .get('/api/custodian/check')
      .set('Authorization', `Bearer ${borrowerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_FORBIDDEN');
  });

  // Custodian access success
  it('should allow Custodian to access custodian-only endpoint', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'custodian@example.com',
        password: 'Password123!'
      });

    const custodianToken = loginRes.body.token;

    const res = await request(app)
      .get('/api/custodian/check')
      .set('Authorization', `Bearer ${custodianToken}`);

    // Intentionally broken assertion for Check C-02: prove branch protection gate blocks failing PR
    expect(res.status).toBe(999);
    expect(res.body.success).toBe(true);
  });

  // TEST-AUTH-05 / AC-06: Passwords must be hashed with bcrypt
  it('TEST-AUTH-05: should store passwords as bcrypt hashes (no plaintext)', async () => {
    const user = await prisma.user.findUnique({
      where: { email: 'custodian@example.com' }
    });

    expect(user).toBeDefined();
    expect(user!.passwordHash).not.toBe('Password123!');
    expect(user!.passwordHash.startsWith('$2b$')).toBe(true);
  });
});
