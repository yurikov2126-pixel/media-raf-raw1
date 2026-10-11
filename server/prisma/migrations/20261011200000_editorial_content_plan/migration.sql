CREATE TABLE "EditorialContentPlanItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IDEA',
    "publishAt" TIMESTAMP(3) NOT NULL,
    "assigneeId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EditorialContentPlanItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EditorialContentPlanItem_publishAt_idx" ON "EditorialContentPlanItem"("publishAt");
CREATE INDEX "EditorialContentPlanItem_assigneeId_publishAt_idx" ON "EditorialContentPlanItem"("assigneeId", "publishAt");
