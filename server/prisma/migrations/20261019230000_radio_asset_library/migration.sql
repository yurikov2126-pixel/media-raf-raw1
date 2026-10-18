CREATE TABLE "RadioAssetFolder" (
 "id" TEXT NOT NULL,
 "name" TEXT NOT NULL,
 "parentId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "RadioAssetFolder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RadioAssetFolder_parentId_idx" ON "RadioAssetFolder"("parentId");
ALTER TABLE "RadioAssetFolder" ADD CONSTRAINT "RadioAssetFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "RadioAssetFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RadioAsset" ADD COLUMN "folderId" TEXT;
ALTER TABLE "RadioAsset" ADD COLUMN "tags" JSONB;
CREATE INDEX "RadioAsset_folderId_idx" ON "RadioAsset"("folderId");
ALTER TABLE "RadioAsset" ADD CONSTRAINT "RadioAsset_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "RadioAssetFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
