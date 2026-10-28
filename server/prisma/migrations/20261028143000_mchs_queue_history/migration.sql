CREATE TABLE "SafetyMchsQueueHistory" (
 "id" TEXT NOT NULL,
 "queueId" TEXT NOT NULL,
 "status" TEXT NOT NULL,
 "reason" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SafetyMchsQueueHistory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SafetyMchsQueueHistory_queueId_status_reason_key" ON "SafetyMchsQueueHistory"("queueId","status","reason");
CREATE INDEX "SafetyMchsQueueHistory_createdAt_idx" ON "SafetyMchsQueueHistory"("createdAt");
ALTER TABLE "SafetyMchsQueueHistory" ADD CONSTRAINT "SafetyMchsQueueHistory_queueId_fkey"
 FOREIGN KEY ("queueId") REFERENCES "SafetyMchsQueueItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
INSERT INTO "SafetyMchsQueueHistory" ("id","queueId","status","reason")
SELECT 'mchsh_' || md5(q."id" || ':OBSERVED:INITIAL_INGEST'),q."id",'OBSERVED','INITIAL_INGEST'
FROM "SafetyMchsQueueItem" q ON CONFLICT ("queueId","status","reason") DO NOTHING;
