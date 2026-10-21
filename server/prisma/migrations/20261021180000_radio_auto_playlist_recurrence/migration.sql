CREATE TABLE "RadioAutoPlaylistRule" (
"id" TEXT NOT NULL,"autoPlaylistId" TEXT NOT NULL,"weekdays" JSONB NOT NULL DEFAULT '[]'::jsonb,
"startMinute" INTEGER NOT NULL,"enabled" BOOLEAN NOT NULL DEFAULT false,"createdBy" TEXT NOT NULL,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
CONSTRAINT "RadioAutoPlaylistRule_pkey" PRIMARY KEY ("id"));
CREATE INDEX "RadioAutoPlaylistRule_enabled_idx" ON "RadioAutoPlaylistRule"("enabled");
ALTER TABLE "RadioAutoPlaylistRule" ADD CONSTRAINT "RadioAutoPlaylistRule_autoPlaylistId_fkey" FOREIGN KEY ("autoPlaylistId") REFERENCES "RadioAutoPlaylist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "RadioAutoPlaylistRuleSlot" (
"id" TEXT NOT NULL,"ruleId" TEXT NOT NULL,"localDate" TEXT NOT NULL,"slotId" TEXT NOT NULL,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "RadioAutoPlaylistRuleSlot_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "RadioAutoPlaylistRuleSlot_ruleId_localDate_key" ON "RadioAutoPlaylistRuleSlot"("ruleId","localDate");
CREATE UNIQUE INDEX "RadioAutoPlaylistRuleSlot_slotId_key" ON "RadioAutoPlaylistRuleSlot"("slotId");
ALTER TABLE "RadioAutoPlaylistRuleSlot" ADD CONSTRAINT "RadioAutoPlaylistRuleSlot_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "RadioAutoPlaylistRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;