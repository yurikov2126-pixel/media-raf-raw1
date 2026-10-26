CREATE TABLE "SafetyMchsDiagnostic" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SafetyMchsDiagnostic_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SafetyMchsDiagnostic_eventId_key" ON "SafetyMchsDiagnostic"("eventId");
CREATE INDEX "SafetyMchsDiagnostic_receivedAt_idx" ON "SafetyMchsDiagnostic"("receivedAt");
