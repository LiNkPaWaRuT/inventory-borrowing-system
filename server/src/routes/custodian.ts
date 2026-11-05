import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/custodian/check [RBAC verification check]
router.get('/check', requireAuth, requireRole('CUSTODIAN'), (req: AuthenticatedRequest, res: Response) => {
  return res.status(200).json({ success: true, message: 'Custodian access confirmed.' });
});

// GET /api/custodian/loans [FR-07, AC-12]
// Custodian views all loan requests and active loans across the department
router.get('/loans', requireAuth, requireRole('CUSTODIAN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const loans = await prisma.loan.findMany({
      include: {
        item: true,
        borrower: {
          select: { id: true, name: true, email: true, role: true }
        }
      },
      orderBy: { requestedAt: 'desc' }
    });

    return res.status(200).json({
      success: true,
      loans
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to retrieve custodian loans.' }
    });
  }
});

export default router;
