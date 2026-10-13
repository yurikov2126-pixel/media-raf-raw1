CREATE TABLE "HomeworkSubmissionVersion" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "text" TEXT,
  "link" TEXT,
  "files" TEXT NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "feedback" TEXT,
  "grade" INTEGER,
  "finalGrade" DOUBLE PRECISION,
  "lateDays" INTEGER,
  "latePenalty" DOUBLE PRECISION,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HomeworkSubmissionVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HomeworkSubmissionVersion_submissionId_version_key" ON "HomeworkSubmissionVersion"("submissionId","version");
CREATE INDEX "HomeworkSubmissionVersion_submissionId_submittedAt_idx" ON "HomeworkSubmissionVersion"("submissionId","submittedAt");
ALTER TABLE "HomeworkSubmissionVersion" ADD CONSTRAINT "HomeworkSubmissionVersion_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "HomeworkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Preserve all existing submissions as their first version.
INSERT INTO "HomeworkSubmissionVersion"
 ("id","submissionId","version","text","link","files","status","feedback","grade","finalGrade","lateDays","latePenalty","reviewedBy","reviewedAt","submittedAt")
SELECT 'hsv_' || "id", "id", 1, "text", "link", "files", "status", "feedback", "grade", "finalGrade", "lateDays", "latePenalty", "reviewedBy", "reviewedAt", "createdAt"
FROM "HomeworkSubmission";
