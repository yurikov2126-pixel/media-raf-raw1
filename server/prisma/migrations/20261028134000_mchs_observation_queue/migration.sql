-- Stores observations only, never commands for radio or speakers.
CREATE TABLE "SafetyMchsQueueItem" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OBSERVED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SafetyMchsQueueItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SafetyMchsQueueItem_eventId_key" ON "SafetyMchsQueueItem"("eventId");
CREATE INDEX "SafetyMchsQueueItem_status_createdAt_idx" ON "SafetyMchsQueueItem"("status", "createdAt");
ALTER TABLE "SafetyMchsQueueItem" ADD CONSTRAINT "SafetyMchsQueueItem_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "SafetyMchsEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Backfill historical observations once. ON CONFLICT provides safe repeated deployment.
INSERT INTO "SafetyMchsQueueItem" ("id","eventId","status","attempts","createdAt","updatedAt")
SELECT 'mchsq_' || md5(e."id"), e."id", 'OBSERVED', 0, e."receivedAt", CURRENT_TIMESTAMP
FROM "SafetyMchsEvent" e
ON CONFLICT ("eventId") DO NOTHING;
