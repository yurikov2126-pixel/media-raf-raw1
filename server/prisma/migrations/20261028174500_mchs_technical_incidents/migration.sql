CREATE TABLE "SafetyMchsTechnicalIncident" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3)
);
CREATE INDEX "SafetyMchsTechnicalIncident_openedAt_idx" ON "SafetyMchsTechnicalIncident"("openedAt");
CREATE INDEX "SafetyMchsTechnicalIncident_kind_resolvedAt_idx" ON "SafetyMchsTechnicalIncident"("kind","resolvedAt");