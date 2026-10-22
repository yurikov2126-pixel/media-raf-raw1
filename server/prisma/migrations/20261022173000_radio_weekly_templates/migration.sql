CREATE TABLE "RadioWeeklyTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "items" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RadioWeeklyTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RadioWeeklyTemplate_name_key" ON "RadioWeeklyTemplate"("name");
