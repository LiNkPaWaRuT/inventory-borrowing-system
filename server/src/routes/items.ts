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

    // An item is only truly available if its DB flag is true AND it has no active or requested loan
    const items = rawItems.map((item) => ({
      id: item.id,
      title: item.title,
      serialNumber: item.serialNumber,
      category: item.category,
      isAvailable: item.isAvailable && item.loans.length === 0,
      hasPendingOrActiveLoan: item.loans.length > 0
    }));

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
