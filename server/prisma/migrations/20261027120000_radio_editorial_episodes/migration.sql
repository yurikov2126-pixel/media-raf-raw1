CREATE TABLE "RadioEditorialEpisode" (
 "id" TEXT NOT NULL,
 "title" TEXT NOT NULL,
 "script" TEXT NOT NULL DEFAULT '',
 "startAt" TIMESTAMP(3) NOT NULL,
 "durationMin" INTEGER NOT NULL DEFAULT 30,
 "status" TEXT NOT NULL DEFAULT 'DRAFT',
 "format" TEXT NOT NULL DEFAULT 'RECORDED',
 "hostIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "slotId" TEXT,
 "createdBy" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "RadioEditorialEpisode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RadioEditorialEpisode_slotId_key" ON "RadioEditorialEpisode"("slotId");
CREATE INDEX "RadioEditorialEpisode_startAt_idx" ON "RadioEditorialEpisode"("startAt");
CREATE INDEX "RadioEditorialEpisode_status_idx" ON "RadioEditorialEpisode"("status");
