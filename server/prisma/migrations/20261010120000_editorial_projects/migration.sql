CREATE TABLE "EditorialProject" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "visibility" TEXT NOT NULL DEFAULT 'CLOSED',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EditorialProject_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EditorialProjectMember" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'PARTICIPANT',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EditorialProjectMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EditorialProjectMember_projectId_userId_key" ON "EditorialProjectMember"("projectId","userId");
CREATE INDEX "EditorialProject_createdById_idx" ON "EditorialProject"("createdById");
CREATE INDEX "EditorialProject_visibility_idx" ON "EditorialProject"("visibility");
CREATE INDEX "EditorialProjectMember_userId_idx" ON "EditorialProjectMember"("userId");
ALTER TABLE "EditorialProject" ADD CONSTRAINT "EditorialProject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EditorialProjectMember" ADD CONSTRAINT "EditorialProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "EditorialProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EditorialProjectMember" ADD CONSTRAINT "EditorialProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
