ALTER TABLE "EditorialProject" ADD COLUMN "eventEndDate" DATE;
ALTER TABLE "EditorialTask" ADD COLUMN "workDate" DATE;
CREATE INDEX "EditorialTask_projectId_workDate_idx" ON "EditorialTask"("projectId", "workDate");
