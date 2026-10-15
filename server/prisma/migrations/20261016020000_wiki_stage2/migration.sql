CREATE TABLE "WikiUserState" ("id" TEXT NOT NULL,"userId" TEXT NOT NULL,"articleId" TEXT NOT NULL,"bookmarked" BOOLEAN NOT NULL DEFAULT false,"lastReadAt" TIMESTAMP(3),"checklist" TEXT NOT NULL DEFAULT '[]',"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "WikiUserState_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "WikiUserState_userId_articleId_key" ON "WikiUserState"("userId","articleId");
CREATE INDEX "WikiUserState_userId_bookmarked_idx" ON "WikiUserState"("userId","bookmarked");
CREATE INDEX "WikiUserState_userId_lastReadAt_idx" ON "WikiUserState"("userId","lastReadAt");
CREATE TABLE "WikiRevision" ("id" TEXT NOT NULL,"articleId" TEXT NOT NULL,"editorId" TEXT,"title" TEXT NOT NULL,"excerpt" TEXT,"content" TEXT NOT NULL,"cover" TEXT,"tags" TEXT NOT NULL DEFAULT '[]',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "WikiRevision_pkey" PRIMARY KEY ("id"));
CREATE INDEX "WikiRevision_articleId_createdAt_idx" ON "WikiRevision"("articleId","createdAt");
CREATE TABLE "WikiProposal" ("id" TEXT NOT NULL,"articleId" TEXT NOT NULL,"authorId" TEXT NOT NULL,"content" TEXT NOT NULL,"note" TEXT,"status" TEXT NOT NULL DEFAULT 'PENDING',"reviewedBy" TEXT,"reviewedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "WikiProposal_pkey" PRIMARY KEY ("id"));
CREATE INDEX "WikiProposal_articleId_status_idx" ON "WikiProposal"("articleId","status");
CREATE INDEX "WikiProposal_status_createdAt_idx" ON "WikiProposal"("status","createdAt");
