CREATE TABLE "SafetyMchsSyntheticReceipt" (
 "id" TEXT NOT NULL,
 "commandId" TEXT NOT NULL,
 "operatorId" TEXT,
 "status" TEXT NOT NULL,
 "duplicateOk" BOOLEAN NOT NULL,
 "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SafetyMchsSyntheticReceipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SafetyMchsSyntheticReceipt_commandId_key" ON "SafetyMchsSyntheticReceipt"("commandId");
CREATE INDEX "SafetyMchsSyntheticReceipt_checkedAt_idx" ON "SafetyMchsSyntheticReceipt"("checkedAt");
