import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/items [AC-07: Borrower/Custodian can view catalog of items with live availability status]
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawItems = await prisma.item.findMany({
      include: {
        loans: {
          where: { status: { in: ['REQUESTED', 'ACTIVE'] } }
        }
      },
      orderBy: { title: 'asc' }
    });

    // An item status:
    // - AVAILABLE: DB flag is true and no active or requested loans
    // - PENDING_APPROVAL: Has a loan in REQUESTED status awaiting Custodian checkout
    // - CHECKED_OUT: Has an ACTIVE loan or DB flag is false
    const items = rawItems.map((item: any) => {
      const hasRequestedLoan = item.loans.some((l: any) => l.status === 'REQUESTED');
      const hasActiveLoan = item.loans.some((l: any) => l.status === 'ACTIVE');

      let catalogStatus: 'AVAILABLE' | 'PENDING_APPROVAL' | 'CHECKED_OUT' | 'MAINTENANCE' = 'AVAILABLE';
      if (item.status === 'MAINTENANCE') {
        catalogStatus = 'MAINTENANCE';
      } else if (hasRequestedLoan) {
        catalogStatus = 'PENDING_APPROVAL';
      } else if (hasActiveLoan || !item.isAvailable) {
        catalogStatus = 'CHECKED_OUT';
      }

      return {
        id: item.id,
        title: item.title,
        serialNumber: item.serialNumber,
        category: item.category,
        isAvailable: item.isAvailable && item.status !== 'MAINTENANCE' && item.loans.length === 0,
        hasPendingOrActiveLoan: item.loans.length > 0,
        catalogStatus
      };
    });

    return res.status(200).json({
      success: true,
      items
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to retrieve item catalog.' }
    });
  }
});

export default router;
