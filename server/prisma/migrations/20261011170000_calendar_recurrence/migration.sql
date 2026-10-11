ALTER TABLE "PersonalCalendarEvent" ADD COLUMN "seriesId" TEXT;
CREATE INDEX "PersonalCalendarEvent_ownerId_seriesId_idx" ON "PersonalCalendarEvent"("ownerId", "seriesId");
