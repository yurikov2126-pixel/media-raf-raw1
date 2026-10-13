CREATE TABLE "AcademyCompetency" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '', "icon" TEXT NOT NULL DEFAULT 'award', "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AcademyCompetency_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "AcademyCompetency_name_key" ON "AcademyCompetency"("name");
ALTER TABLE "Course" ADD COLUMN "competencyIds" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "EditorialTask" ADD COLUMN "requiredCompetencyIds" TEXT NOT NULL DEFAULT '[]';
