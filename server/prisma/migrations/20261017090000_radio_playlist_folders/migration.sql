CREATE TABLE "RadioPlaylistFolder" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "RadioPlaylistFolder_pkey" PRIMARY KEY ("id"));
ALTER TABLE "RadioPlaylist" ADD COLUMN "folderId" TEXT;
CREATE INDEX "RadioPlaylist_folderId_idx" ON "RadioPlaylist"("folderId");
ALTER TABLE "RadioPlaylist" ADD CONSTRAINT "RadioPlaylist_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "RadioPlaylistFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
