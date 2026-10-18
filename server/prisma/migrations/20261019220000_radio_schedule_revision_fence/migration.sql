-- Database-enforced fencing revision. All changes are captured, including changes
-- made outside the Express API. The trigger runs within the same transaction.
CREATE TABLE "RadioScheduleRevision" (
    "id" INTEGER NOT NULL,
    "revision" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RadioScheduleRevision_pkey" PRIMARY KEY ("id")
);
INSERT INTO "RadioScheduleRevision" ("id","revision") VALUES (1,0);

CREATE OR REPLACE FUNCTION "radio_bump_schedule_revision"()
RETURNS trigger AS $$
BEGIN
  UPDATE "RadioScheduleRevision"
     SET "revision" = "revision" + 1,
         "updatedAt" = CURRENT_TIMESTAMP
   WHERE "id" = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Radio schedule revision singleton missing';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "radio_revision_schedule"
 AFTER INSERT OR UPDATE OR DELETE ON "RadioScheduleSlot"
 FOR EACH STATEMENT EXECUTE FUNCTION "radio_bump_schedule_revision"();
CREATE TRIGGER "radio_revision_playlist"
 AFTER INSERT OR UPDATE OR DELETE ON "RadioPlaylist"
 FOR EACH STATEMENT EXECUTE FUNCTION "radio_bump_schedule_revision"();
CREATE TRIGGER "radio_revision_playlist_items"
 AFTER INSERT OR UPDATE OR DELETE ON "RadioPlaylistItem"
 FOR EACH STATEMENT EXECUTE FUNCTION "radio_bump_schedule_revision"();
-- An asset's availability and playability can change independently of the slots.
CREATE TRIGGER "radio_revision_assets"
 AFTER INSERT OR UPDATE OR DELETE ON "RadioAsset"
 FOR EACH STATEMENT EXECUTE FUNCTION "radio_bump_schedule_revision"();
