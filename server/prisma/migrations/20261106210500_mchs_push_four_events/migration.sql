CREATE TABLE "SafetyMchsPushDelivery" (
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "webSent" INTEGER NOT NULL DEFAULT 0,
    "mobileSent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    CONSTRAINT "SafetyMchsPushDelivery_pkey" PRIMARY KEY ("eventId")
);

CREATE INDEX "SafetyMchsPushDelivery_status_createdAt_idx"
ON "SafetyMchsPushDelivery"("status", "createdAt");
