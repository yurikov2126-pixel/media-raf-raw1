CREATE TABLE "EditorialLibraryFile" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "storageName" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "size" INTEGER NOT NULL, "description" TEXT NOT NULL DEFAULT '', "uploaderId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "EditorialLibraryFile_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "EditorialLibraryFile_storageName_key" ON "EditorialLibraryFile"("storageName");
CREATE INDEX "EditorialLibraryFile_createdAt_idx" ON "EditorialLibraryFile"("createdAt");
CREATE TABLE "EditorialFileShare" ("id" TEXT NOT NULL, "token" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '', "fileIds" JSONB NOT NULL, "createdById" TEXT NOT NULL, "expiresAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "EditorialFileShare_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "EditorialFileShare_token_key" ON "EditorialFileShare"("token");
CREATE INDEX "EditorialFileShare_createdAt_idx" ON "EditorialFileShare"("createdAt");
