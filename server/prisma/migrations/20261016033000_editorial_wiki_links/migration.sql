CREATE TABLE "EditorialTaskWikiLink" ("id" TEXT NOT NULL, "taskId" TEXT NOT NULL, "articleId" TEXT NOT NULL, "excluded" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "EditorialTaskWikiLink_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "EditorialTaskWikiLink_taskId_articleId_key" ON "EditorialTaskWikiLink"("taskId","articleId");
CREATE INDEX "EditorialTaskWikiLink_taskId_idx" ON "EditorialTaskWikiLink"("taskId");
