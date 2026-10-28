CREATE TABLE "SafetyMchsTelemetrySample" (
 "id" TEXT NOT NULL,
 "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "listener" TEXT NOT NULL,
 "push" TEXT NOT NULL,
 "queuedLocal" INTEGER,
 "failedSends" INTEGER,
 "retryPending" INTEGER,
 "oldestPendingAt" TIMESTAMP(3),
 "nextRetryAt" TIMESTAMP(3),
 "snapshotOk" BOOLEAN,
 "snapshotAt" TIMESTAMP(3),
 "lastSentAt" TIMESTAMP(3),
 "telemetryPresent" BOOLEAN NOT NULL DEFAULT false,
 CONSTRAINT "SafetyMchsTelemetrySample_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SafetyMchsTelemetrySample_receivedAt_idx" ON "SafetyMchsTelemetrySample"("receivedAt");