ALTER TABLE "RadioEditorialEpisode" ADD COLUMN "mediaAssetIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "RadioEditorialEpisode" ADD COLUMN "seriesKey" TEXT;
