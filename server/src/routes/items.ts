import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/items [AC-07: Borrower/Custodian can view catalog of items with live isAvailable status]
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const items = await prisma.item.findMany({
      orderBy: { title: 'asc' }
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
