ALTER TABLE "RadioPlaylist" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "RadioPlaylist_archivedAt_idx" ON "RadioPlaylist"("archivedAt");
