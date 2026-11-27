-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'AVAILABLE';

-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "conditionGrade" TEXT,
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "penaltyFine" DOUBLE PRECISION DEFAULT 0.0,
ADD COLUMN     "returnNotes" TEXT;
