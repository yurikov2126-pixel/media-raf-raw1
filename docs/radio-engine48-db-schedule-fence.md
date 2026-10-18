# Audio Engine 4.8 — database-backed radio schedule fencing

This change replaces the temporary schedule fingerprint in the Radio Handover **dry-run** with a PostgreSQL revision counter. A singleton `RadioScheduleRevision` row is updated in the same transaction as radio schedule/playlist/asset mutations by database triggers. This captures changes by any process, not just one Express route.

## Database migration
Migration `20261019220000_radio_schedule_revision_fence` creates the singleton and statement-level INSERT/UPDATE/DELETE triggers on `RadioScheduleSlot`, `RadioPlaylist`, `RadioPlaylistItem`, and `RadioAsset`. These deliberately favor conservative invalidation over missing playlist or asset changes.

Readiness preflight now obtains approved schedule occupancy and monotonic revision from **one PostgreSQL Repeatable Read snapshot**. A new preparation/verification can detect any committed schedule edit between the two reads. Unknown, missing or unsafe revision values fail closed.

## Important limitations
- This migration must pass Prisma migrate deploy before using dry-run prepare/verify in production. Do not manually enable experimental radio flags.
- Revision increments are transactional, but there is **still no audio switch or Worker-side compare-and-swap**. A schedule change immediately after the second read can invalidate the decision. The eventual switching transaction must validate again at the actual output boundary, with a Worker fencing token and output authority.
- The shadow PCM buffer is not production output. Never interpret preflight success as permission to broadcast or as a hardware action.
- The revision is a bigint in PostgreSQL, converted only when within the JS safe integer range for the current dry-run coordinator. A future on-air switch should use bigint/string fencing throughout.

## Pre-merge verification
Run `cd server && npx prisma validate`, `npm test -- radioHandoverObservation`, all server tests and lint, and the client build. In a disposable PostgreSQL database, run Prisma migrate deploy, then test create/move/delete schedule; insert/update/delete playlist and playlist item; asset updates; transaction rollback; and two simultaneous writers. Confirm rolled-back changes do not commit revisions. Verify scheduled shows are never preempted.
 
No public MP3 output, school PA/amplifier/ESP32, relay or Windows Agent is involved.
