CREATE TABLE "RadioAsset" (
 "id" TEXT NOT NULL, "name" TEXT NOT NULL, "storageKey" TEXT NOT NULL,
 "mimeType" TEXT NOT NULL, "byteSize" INTEGER NOT NULL, "durationMs" INTEGER NOT NULL,
 "sha256" TEXT NOT NULL, "createdBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "RadioAsset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RadioAsset_storageKey_key" ON "RadioAsset"("storageKey");
CREATE TABLE "RadioPlaylist" (
 "id" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '',
 "status" TEXT NOT NULL DEFAULT 'DRAFT', "createdBy" TEXT NOT NULL,
 "approvedBy" TEXT, "approvedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "RadioPlaylist_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RadioPlaylistItem" (
 "id" TEXT NOT NULL, "playlistId" TEXT NOT NULL, "assetId" TEXT NOT NULL, "position" INTEGER NOT NULL,
 CONSTRAINT "RadioPlaylistItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RadioPlaylistItem_playlistId_position_key" ON "RadioPlaylistItem"("playlistId","position");
ALTER TABLE "RadioPlaylistItem" ADD CONSTRAINT "RadioPlaylistItem_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "RadioPlaylist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RadioPlaylistItem" ADD CONSTRAINT "RadioPlaylistItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "RadioAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "RadioScheduleSlot" (
 "id" TEXT NOT NULL, "playlistId" TEXT NOT NULL, "startAt" TIMESTAMP(3) NOT NULL,
 "endAt" TIMESTAMP(3) NOT NULL, "createdBy" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "RadioScheduleSlot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RadioScheduleSlot_startAt_endAt_idx" ON "RadioScheduleSlot"("startAt","endAt");
ALTER TABLE "RadioScheduleSlot" ADD CONSTRAINT "RadioScheduleSlot_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "RadioPlaylist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
