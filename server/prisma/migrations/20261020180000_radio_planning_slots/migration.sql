-- Planning slots reserve an editorial timeslot but do not activate playout.
ALTER TABLE "RadioScheduleSlot" ALTER COLUMN "playlistId" DROP NOT NULL;
ALTER TABLE "RadioScheduleSlot" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';
