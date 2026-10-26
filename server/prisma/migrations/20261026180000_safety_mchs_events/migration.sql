CREATE TABLE "SafetyMchsEvent" (
 "id" TEXT NOT NULL, "source" TEXT NOT NULL DEFAULT 'MCHS_ANDROID',
 "sourceEventId" TEXT NOT NULL, "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "occurredAt" TIMESTAMP(3), "title" TEXT NOT NULL, "body" TEXT NOT NULL,
 "channelId" TEXT, "region" TEXT, "eventType" TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
 "verified" BOOLEAN NOT NULL DEFAULT false, "raw" JSONB,
 CONSTRAINT "SafetyMchsEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SafetyMchsEvent_source_sourceEventId_key" ON "SafetyMchsEvent"("source", "sourceEventId");
CREATE INDEX "SafetyMchsEvent_receivedAt_idx" ON "SafetyMchsEvent"("receivedAt");
CREATE TABLE "SafetyMchsHealth" (
 "id" TEXT NOT NULL, "lastSeenAt" TIMESTAMP(3),
 "listener" TEXT NOT NULL DEFAULT 'UNKNOWN',
 "push" TEXT NOT NULL DEFAULT 'UNKNOWN',
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "SafetyMchsHealth_pkey" PRIMARY KEY ("id")
);
