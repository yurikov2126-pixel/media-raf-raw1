ALTER TABLE "Post" ADD COLUMN "pinnedAt" TIMESTAMP(3);
CREATE INDEX "Post_authorId_pinnedAt_idx" ON "Post"("authorId", "pinnedAt");
