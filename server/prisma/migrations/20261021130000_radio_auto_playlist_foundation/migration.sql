CREATE TABLE "RadioAutoPlaylist" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sourceFolderId" TEXT NOT NULL,
  "includeChildren" BOOLEAN NOT NULL DEFAULT true,
  "targetMinutes" INTEGER NOT NULL DEFAULT 60,
  "trackOrder" TEXT NOT NULL DEFAULT 'SMART',
  "minTrackGap" INTEGER NOT NULL DEFAULT 20,
  "jingleAssetIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "jingleEvery" INTEGER NOT NULL DEFAULT 3,
  "fadeMs" INTEGER NOT NULL DEFAULT 2000,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RadioAutoPlaylist_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RadioAutoPlaylist_sourceFolderId_idx" ON "RadioAutoPlaylist"("sourceFolderId");
ALTER TABLE "RadioAutoPlaylist" ADD CONSTRAINT "RadioAutoPlaylist_sourceFolderId_fkey"
 FOREIGN KEY ("sourceFolderId") REFERENCES "RadioAssetFolder"("id")
 ON DELETE RESTRICT ON UPDATE CASCADE;
