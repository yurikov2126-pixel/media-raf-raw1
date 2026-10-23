-- Existing folder assignments remain MUSIC until an administrator chooses a category.
ALTER TABLE "RadioAssetFolder" ADD COLUMN "category" TEXT;
UPDATE "RadioAssetFolder" SET "category" = 'MUSIC' WHERE "category" IS NULL;
