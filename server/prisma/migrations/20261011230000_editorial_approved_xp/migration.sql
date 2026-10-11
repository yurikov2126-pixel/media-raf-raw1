CREATE TABLE "EditorialTaskXpAward" (
  "taskId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EditorialTaskXpAward_pkey" PRIMARY KEY ("taskId")
);
CREATE INDEX "EditorialTaskXpAward_userId_awardedAt_idx" ON "EditorialTaskXpAward"("userId", "awardedAt");
ALTER TABLE "EditorialTaskXpAward" ADD CONSTRAINT "EditorialTaskXpAward_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "EditorialTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EditorialTaskXpAward" ADD CONSTRAINT "EditorialTaskXpAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
INSERT INTO "Setting" ("key", "value") VALUES ('gamification_editorial_approved_xp', '50') ON CONFLICT ("key") DO NOTHING;
