ALTER TABLE "EditorialTask" ADD COLUMN "assignmentDecision" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "EditorialTask" ADD COLUMN "assignmentDeclineReason" TEXT;
ALTER TABLE "EditorialTask" ADD COLUMN "assignmentRespondedAt" TIMESTAMP(3);
