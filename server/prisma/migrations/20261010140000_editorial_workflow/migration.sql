CREATE TABLE "EditorialStage" (
"id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "title" TEXT NOT NULL, "position" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "EditorialStage_pkey" PRIMARY KEY ("id"));
CREATE TABLE "EditorialTask" (
"id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "stageId" TEXT, "parentId" TEXT, "title" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '', "status" TEXT NOT NULL DEFAULT 'TODO', "assigneeId" TEXT, "createdById" TEXT NOT NULL, "dueAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
CONSTRAINT "EditorialTask_pkey" PRIMARY KEY ("id"));
CREATE TABLE "EditorialTaskDependency" (
"taskId" TEXT NOT NULL, "dependsOnId" TEXT NOT NULL,
CONSTRAINT "EditorialTaskDependency_pkey" PRIMARY KEY ("taskId","dependsOnId"));
CREATE INDEX "EditorialStage_projectId_position_idx" ON "EditorialStage"("projectId","position");
CREATE INDEX "EditorialTask_projectId_status_idx" ON "EditorialTask"("projectId","status");
CREATE INDEX "EditorialTask_assigneeId_dueAt_idx" ON "EditorialTask"("assigneeId","dueAt");
CREATE INDEX "EditorialTask_parentId_idx" ON "EditorialTask"("parentId");
CREATE INDEX "EditorialTaskDependency_dependsOnId_idx" ON "EditorialTaskDependency"("dependsOnId");
ALTER TABLE "EditorialStage" ADD CONSTRAINT "EditorialStage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "EditorialProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EditorialTask" ADD CONSTRAINT "EditorialTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "EditorialProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EditorialTask" ADD CONSTRAINT "EditorialTask_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "EditorialStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EditorialTask" ADD CONSTRAINT "EditorialTask_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "EditorialTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EditorialTask" ADD CONSTRAINT "EditorialTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EditorialTask" ADD CONSTRAINT "EditorialTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EditorialTaskDependency" ADD CONSTRAINT "EditorialTaskDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "EditorialTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EditorialTaskDependency" ADD CONSTRAINT "EditorialTaskDependency_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "EditorialTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EditorialTaskDependency" ADD CONSTRAINT "EditorialTaskDependency_no_self" CHECK ("taskId" <> "dependsOnId");
