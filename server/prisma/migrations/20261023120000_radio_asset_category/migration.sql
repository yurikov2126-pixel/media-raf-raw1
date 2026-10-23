ALTER TABLE "RadioAsset" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'MUSIC';
UPDATE "RadioAsset" SET "category" = 'MUSIC';
CREATE INDEX "RadioAsset_category_idx" ON "RadioAsset"("category");
