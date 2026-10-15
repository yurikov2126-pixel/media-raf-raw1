CREATE TABLE "EditorialWikiChecklistState" ("id" TEXT NOT NULL,"taskId" TEXT NOT NULL,"articleId" TEXT NOT NULL,"userId" TEXT NOT NULL,"checked" TEXT NOT NULL DEFAULT '[]',"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "EditorialWikiChecklistState_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "EditorialWikiChecklistState_taskId_articleId_userId_key" ON "EditorialWikiChecklistState"("taskId","articleId","userId");
CREATE INDEX "EditorialWikiChecklistState_taskId_userId_idx" ON "EditorialWikiChecklistState"("taskId","userId");
