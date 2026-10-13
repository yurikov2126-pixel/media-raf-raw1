ALTER TABLE "Homework" ADD COLUMN "rubric" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "PracticalWork" ADD COLUMN "rubric" TEXT NOT NULL DEFAULT '[]';
CREATE TABLE "LearningDiscussionMessage" (
 "id" TEXT NOT NULL, "kind" TEXT NOT NULL, "workId" TEXT NOT NULL,
 "studentId" TEXT NOT NULL, "authorId" TEXT NOT NULL, "text" TEXT NOT NULL,
 "files" TEXT NOT NULL DEFAULT '[]', "version" INTEGER,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "LearningDiscussionMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LearningDiscussionMessage_kind_workId_studentId_createdAt_idx" ON "LearningDiscussionMessage"("kind","workId","studentId","createdAt");
CREATE INDEX "LearningDiscussionMessage_authorId_idx" ON "LearningDiscussionMessage"("authorId");
CREATE TABLE "LearningRubricGrade" (
 "id" TEXT NOT NULL, "kind" TEXT NOT NULL, "submissionId" TEXT NOT NULL,
 "criteria" TEXT NOT NULL, "reviewedBy" TEXT NOT NULL, 
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "LearningRubricGrade_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LearningRubricGrade_kind_submissionId_idx" ON "LearningRubricGrade"("kind","submissionId");
