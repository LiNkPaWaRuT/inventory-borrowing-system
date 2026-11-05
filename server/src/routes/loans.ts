import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// POST /api/loans/request [AC-08, AC-09, AC-10, BR-01, BR-02]
// Borrower initiates a borrow request for an available item
router.post('/request', requireAuth, requireRole('BORROWER'), async (req: AuthenticatedRequest, res: Response) => {
  const { itemId } = req.body;

  if (!itemId) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'itemId is required.' }
    });
  }

  try {
    const item = await prisma.item.findUnique({
      where: { id: itemId }
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        error: { code: 'ITEM_NOT_FOUND', message: 'Item does not exist in catalog.' }
      });
    }

    // BR-01 (Single Item Exclusivity): Reject if item is not available
    if (!item.isAvailable) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'ITEM_UNAVAILABLE',
          message: 'Item is not available for borrowing.'
        }
      });
    }

    // BR-02 (No Duplicate Active Loans): Reject if there is already an active or requested loan
    const existingLoan = await prisma.loan.findFirst({
      where: {
        itemId,
        status: { in: ['REQUESTED', 'ACTIVE'] }
      }
    });

    if (existingLoan) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'ITEM_UNAVAILABLE',
          message: 'Item already has an active or pending loan request.'
        }
      });
    }

    const loan = await prisma.loan.create({
      data: {
        itemId,
        borrowerId: req.user!.userId,
        status: 'REQUESTED'
      },
      include: {
        item: true
      }
    });

    return res.status(201).json({
      success: true,
      loan
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to create borrow request.' }
    });
  }
});

// GET /api/loans/my-loans [FR-06, BR-04]
// Borrower retrieves only their own loan records
router.get('/my-loans', requireAuth, requireRole('BORROWER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const loans = await prisma.loan.findMany({
      where: { borrowerId: req.user!.userId },
      include: { item: true },
      orderBy: { requestedAt: 'desc' }
    });

    return res.status(200).json({
      success: true,
      loans
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to retrieve personal loans.' }
    });
  }
});

// GET /api/loans/:id [BR-04, AC-11]
// Inspect specific loan details with strict ownership isolation
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const loan = await prisma.loan.findUnique({
      where: { id },
      include: {
        item: true,
        borrower: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    });

    if (!loan) {
      return res.status(404).json({
        success: false,
        error: { code: 'LOAN_NOT_FOUND', message: 'Loan record not found.' }
      });
    }

    // BR-04 (Ownership Isolation): Borrower A attempting to view Borrower B's loan returns 403 Forbidden
    if (req.user!.role === 'BORROWER' && loan.borrowerId !== req.user!.userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_LOAN_ACCESS',
          message: 'Access denied: You do not have permission to view another user’s loan record.'
        }
      });
    }

    return res.status(200).json({
      success: true,
      loan
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to retrieve loan record.' }
    });
  }
});

// POST /api/loans/:id/checkout [AC-12, BR-01, BR-03]
// Custodian approves loan request, transitioning to ACTIVE and reserving item
router.post('/:id/checkout', requireAuth, requireRole('CUSTODIAN'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const loan = await prisma.loan.findUnique({
      where: { id },
      include: { item: true }
    });

    if (!loan) {
      return res.status(404).json({
        success: false,
        error: { code: 'LOAN_NOT_FOUND', message: 'Loan record not found.' }
      });
    }

    if (loan.status !== 'REQUESTED') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'ITEM_UNAVAILABLE',
          message: `Cannot checkout loan with current status: ${loan.status}.`
        }
      });
    }

    // BR-01: Check item availability
    if (!loan.item.isAvailable) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'ITEM_UNAVAILABLE',
          message: 'Associated inventory item is already checked out.'
        }
      });
    }

    // Atomic transaction: mark loan ACTIVE and item isAvailable = false
    const [updatedLoan, updatedItem] = await prisma.$transaction([
      prisma.loan.update({
        where: { id: loan.id },
        data: {
          status: 'ACTIVE',
          checkedOutAt: new Date()
        }
      }),
      prisma.item.update({
        where: { id: loan.itemId },
        data: {
          isAvailable: false
        }
      })
    ]);

    return res.status(200).json({
      success: true,
      loan: {
        ...updatedLoan,
        item: updatedItem
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to process equipment checkout.' }
    });
  }
});

export default router;
