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

    // BR-04 (Per-Borrower Concurrent Loan Quota): Reject if borrower holds >= 2 REQUESTED or ACTIVE loans
    const activeLoanCount = await prisma.loan.count({
      where: {
        borrowerId: req.user!.userId,
        status: { in: ['REQUESTED', 'ACTIVE'] }
      }
    });

    if (activeLoanCount >= 2) {
      return res.status(409).json({
        success: false,
        error: 'LOAN_LIMIT_EXCEEDED',
        message: 'Borrower has reached the maximum limit of 2 concurrent loans (pending or active).'
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

// POST /api/loans/batch [FR-10, BR-04, BR-09, AC-20, AC-21, AC-22]
// Multi-item transactional batch borrow request with quota verification and atomic rollback
router.post('/batch', requireAuth, requireRole('BORROWER'), async (req: AuthenticatedRequest, res: Response) => {
  const { itemIds } = req.body;

  if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_INPUT',
      message: 'itemIds must be a non-empty array of item IDs.'
    });
  }

  // Quota & Batch boundary: Max 2 items in batch
  if (itemIds.length > 2) {
    return res.status(409).json({
      success: false,
      error: 'LOAN_LIMIT_EXCEEDED',
      message: 'Batch request exceeds borrower concurrent loan limit of 2.'
    });
  }

  // Reject duplicate items in same batch
  const uniqueItemIds = Array.from(new Set(itemIds));
  if (uniqueItemIds.length !== itemIds.length) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_INPUT',
      message: 'Batch request cannot contain duplicate items.'
    });
  }

  try {
    // BR-04 & BR-09: Pre-check borrower concurrent loan quota
    const activeLoanCount = await prisma.loan.count({
      where: {
        borrowerId: req.user!.userId,
        status: { in: ['REQUESTED', 'ACTIVE'] }
      }
    });

    if (activeLoanCount + itemIds.length > 2) {
      return res.status(409).json({
        success: false,
        error: 'LOAN_LIMIT_EXCEEDED',
        message: 'Batch request exceeds borrower concurrent loan limit of 2.'
      });
    }

    // Atomic execution inside Prisma Transaction (BR-09, AC-20, AC-22)
    const createdLoans = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const itemId of itemIds) {
        const item = await tx.item.findUnique({
          where: { id: itemId }
        });

        if (!item || !item.isAvailable) {
          const err: any = new Error(`Item ${item?.title || itemId} is not available for borrowing.`);
          err.code = 'ITEM_UNAVAILABLE';
          throw err;
        }

        const existingLoan = await tx.loan.findFirst({
          where: {
            itemId,
            status: { in: ['REQUESTED', 'ACTIVE'] }
          }
        });

        if (existingLoan) {
          const err: any = new Error(`Item ${item.title} already has an active or pending loan.`);
          err.code = 'ITEM_UNAVAILABLE';
          throw err;
        }

        const loan = await tx.loan.create({
          data: {
            itemId,
            borrowerId: req.user!.userId,
            status: 'REQUESTED'
          },
          include: {
            item: true
          }
        });

        results.push(loan);
      }

      return results;
    });

    return res.status(201).json({
      success: true,
      count: createdLoans.length,
      loans: createdLoans
    });
  } catch (error: any) {
    if (error.code === 'ITEM_UNAVAILABLE') {
      return res.status(409).json({
        success: false,
        error: 'ITEM_UNAVAILABLE',
        message: error.message
      });
    }

    if (error.code === 'LOAN_LIMIT_EXCEEDED') {
      return res.status(409).json({
        success: false,
        error: 'LOAN_LIMIT_EXCEEDED',
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to process batch borrow request.' }
    });
  }
});

// Helper function: Compute overdue status, days overdue, and accrued penalty fine (FR-09, BR-08)
export const computeLoanOverdueDetails = (loan: any) => {
  const now = new Date();
  let isOverdue = false;
  let daysOverdue = 0;
  let accruedFine = loan.penaltyFine || 0.0;

  if (loan.status === 'ACTIVE' && loan.dueAt) {
    const dueTime = new Date(loan.dueAt).getTime();
    const diffMs = now.getTime() - dueTime;
    if (diffMs > 0) {
      isOverdue = true;
      daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (daysOverdue === 0 && diffMs > 0) {
        daysOverdue = 1;
      }
      accruedFine = daysOverdue * 5.0; // $5.00 per day
    }
  } else if (loan.status === 'RETURNED' && (loan.penaltyFine || 0) > 0) {
    isOverdue = true;
    accruedFine = loan.penaltyFine;
  }

  return {
    ...loan,
    isOverdue,
    daysOverdue,
    accruedFine
  };
};

// GET /api/loans/my-loans [FR-06, BR-04]
// Borrower retrieves only their own loan records
router.get('/my-loans', requireAuth, requireRole('BORROWER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawLoans = await prisma.loan.findMany({
      where: { borrowerId: req.user!.userId },
      include: { item: true },
      orderBy: { requestedAt: 'desc' }
    });

    const loans = rawLoans.map(computeLoanOverdueDetails);

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

    // Atomic transaction: mark loan ACTIVE, assign dueAt (7 days), and item isAvailable = false
    const checkedOutAt = new Date();
    const dueAt = new Date(checkedOutAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 calendar days

    const [updatedLoan, updatedItem] = await prisma.$transaction([
      prisma.loan.update({
        where: { id: loan.id },
        data: {
          status: 'ACTIVE',
          checkedOutAt,
          dueAt
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

// POST /api/loans/:id/return [FR-08, BR-06, BR-07, AC-15, AC-16, AC-17]
// Custodian checks in an active loan, assesses condition (GOOD, FAIR, DAMAGED), records notes, and updates item status
router.post('/:id/return', requireAuth, requireRole('CUSTODIAN'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { conditionGrade = 'GOOD', returnNotes } = req.body;

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

    // BR-06: Non-active loans cannot be returned (must be ACTIVE)
    if (loan.status !== 'ACTIVE') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'INVALID_LOAN_STATUS',
          message: `Cannot check in return for loan with status: ${loan.status}. Loan must be ACTIVE.`
        }
      });
    }

    // BR-07: Damaged condition quarantines item in MAINTENANCE (isAvailable = false)
    // GOOD or FAIR restores item availability to true (status = AVAILABLE)
    const isDamaged = conditionGrade === 'DAMAGED';
    const itemAvailable = !isDamaged;
    const itemStatus = isDamaged ? 'MAINTENANCE' : 'AVAILABLE';

    // FR-09 / BR-08: Finalize overdue penalty fine upon return if loan returned past dueAt
    const returnedAt = new Date();
    let penaltyFine = loan.penaltyFine || 0.0;
    if (loan.dueAt) {
      const diffMs = returnedAt.getTime() - new Date(loan.dueAt).getTime();
      if (diffMs > 0) {
        let daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (daysOverdue === 0 && diffMs > 0) {
          daysOverdue = 1;
        }
        penaltyFine = daysOverdue * 5.0; // $5.00/day
      }
    }

    const [updatedLoan, updatedItem] = await prisma.$transaction([
      prisma.loan.update({
        where: { id: loan.id },
        data: {
          status: 'RETURNED',
          conditionGrade,
          returnNotes: returnNotes || null,
          returnedAt,
          penaltyFine
        }
      }),
      prisma.item.update({
        where: { id: loan.itemId },
        data: {
          isAvailable: itemAvailable,
          status: itemStatus
        }
      })
    ]);

    return res.status(200).json({
      success: true,
      message: 'Equipment return successfully recorded.',
      loan: updatedLoan,
      item: updatedItem
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to process equipment return.' }
    });
  }
});

export default router;
