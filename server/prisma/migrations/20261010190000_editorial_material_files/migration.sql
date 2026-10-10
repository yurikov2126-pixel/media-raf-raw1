CREATE TABLE "EditorialMaterialFile" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageName" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EditorialMaterialFile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EditorialMaterialFile_storageName_key" ON "EditorialMaterialFile"("storageName");
CREATE INDEX "EditorialMaterialFile_taskId_version_idx" ON "EditorialMaterialFile"("taskId", "version");
ALTER TABLE "EditorialMaterialFile" ADD CONSTRAINT "EditorialMaterialFile_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "EditorialTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EditorialMaterialFile" ADD CONSTRAINT "EditorialMaterialFile_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
