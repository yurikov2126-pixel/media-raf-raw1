CREATE TABLE "SafetyMchsPlaybackIntent" (
 "id" TEXT NOT NULL,
 "eventId" TEXT NOT NULL,
 "eventType" TEXT NOT NULL,
 "audioAssetId" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'STAGED',
 "attempts" INTEGER NOT NULL DEFAULT 0,
 "lastError" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "SafetyMchsPlaybackIntent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SafetyMchsPlaybackIntent_eventId_key" ON "SafetyMchsPlaybackIntent"("eventId");
CREATE INDEX "SafetyMchsPlaybackIntent_status_createdAt_idx" ON "SafetyMchsPlaybackIntent"("status","createdAt");
