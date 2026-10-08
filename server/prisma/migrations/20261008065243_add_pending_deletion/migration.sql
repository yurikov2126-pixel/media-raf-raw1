-- CreateTable
CREATE TABLE "PendingDeletion" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executeAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingDeletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingDeletion_executeAt_idx" ON "PendingDeletion"("executeAt");

-- CreateIndex
CREATE INDEX "PendingDeletion_adminId_idx" ON "PendingDeletion"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "PendingDeletion_entityType_entityId_key" ON "PendingDeletion"("entityType", "entityId");
