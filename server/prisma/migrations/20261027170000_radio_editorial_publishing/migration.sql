ALTER TABLE "RadioEditorialEpisode" ADD COLUMN "publishedPlaylistId" TEXT;
ALTER TABLE "RadioEditorialEpisode" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "RadioEditorialEpisode" ADD COLUMN "liveReady" BOOLEAN NOT NULL DEFAULT false;
