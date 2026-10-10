ALTER TABLE "EditorialTask" ADD COLUMN "isOpen" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "EditorialTaskComment" (
"id" TEXT NOT NULL, "taskId" TEXT NOT NULL, "authorId" TEXT NOT NULL, "body" TEXT NOT NULL,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "EditorialTaskComment_pkey" PRIMARY KEY ("id"));
CREATE TABLE "EditorialTaskApplication" (
"id" TEXT NOT NULL, "taskId" TEXT NOT NULL, "userId" TEXT NOT NULL,
"status" TEXT NOT NULL DEFAULT 'PENDING', "note" TEXT NOT NULL DEFAULT '',
"reviewedById" TEXT, "reviewedAt" TIMESTAMP(3),
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "EditorialTaskApplication_pkey" PRIMARY KEY ("id"));
CREATE TABLE "EditorialTaskEvent" (
"id" TEXT NOT NULL, "taskId" TEXT NOT NULL, "actorId" TEXT NOT NULL,
"action" TEXT NOT NULL, "details" TEXT NOT NULL DEFAULT '{}',
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "EditorialTaskEvent_pkey" PRIMARY KEY ("id"));
CREATE INDEX "EditorialTaskComment_taskId_createdAt_idx" ON "EditorialTaskComment"("taskId","createdAt");
CREATE UNIQUE INDEX "EditorialTaskApplication_taskId_userId_key" ON "EditorialTaskApplication"("taskId","userId");
CREATE INDEX "EditorialTaskApplication_taskId_status_idx" ON "EditorialTaskApplication"("taskId","status");
CREATE INDEX "EditorialTaskEvent_taskId_createdAt_idx" ON "EditorialTaskEvent"("taskId","createdAt");
ALTER TABLE "EditorialTaskComment" ADD CONSTRAINT "EditorialTaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "EditorialTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EditorialTaskComment" ADD CONSTRAINT "EditorialTaskComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EditorialTaskApplication" ADD CONSTRAINT "EditorialTaskApplication_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "EditorialTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EditorialTaskApplication" ADD CONSTRAINT "EditorialTaskApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EditorialTaskEvent" ADD CONSTRAINT "EditorialTaskEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "EditorialTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EditorialTaskEvent" ADD CONSTRAINT "EditorialTaskEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
