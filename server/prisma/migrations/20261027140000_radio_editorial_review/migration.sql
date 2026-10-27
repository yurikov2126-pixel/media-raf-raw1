ALTER TABLE "RadioEditorialEpisode" ADD COLUMN "reviewReason" TEXT;
ALTER TABLE "RadioEditorialEpisode" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "RadioEditorialEpisode" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "RadioEditorialEpisode" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "RadioEditorialEpisode" ADD COLUMN "scriptRevision" INTEGER NOT NULL DEFAULT 1;
