# Radio 2.0 — Audio Engine 4.5: authoritative schedule diagnostics

The authenticated admin-only `radio:studio:health` query now checks PostgreSQL for an **approved schedule slot active at server time**, matching the Worker schedule filter: `startAt <= now < endAt`, `playlist.status = APPROVED`, earliest active start wins.

- If an approved slot is active, the presenter cannot displace it in the recommendation.
- A missing active slot is reported as clear; this is **not** authorization to switch audio output.
- A failed/unavailable schedule query blocks even diagnostic readiness and returns `SCHEDULE_AUTHORITY_UNAVAILABLE`.
- `scheduledSourceReady` remains false unless a future authoritative file/decoder readiness probe verifies it. Playlist approval alone does not prove playable media.
- UI displays busy/clear/unknown independently of PCM health.

This is read-only. The Worker and MP3 encoder are unchanged; `changeApplied:false`, `liveOutputConnected:false`. Shadow PCM readiness still does not authorize public station handover. The authoritative PCM playout boundary, lease fencing, schedule checks at switch time and tests for emergency Auto-DJ rollback must precede any live switch.

Before merge: run `cd server && npm test -- radioScheduleAuthority` and full lint/tests; run client build/lint. Test a scheduled broadcast overlapping the current time, inactive slots, DB failure, and unavailable Worker in an isolated environment. Never connect school PA/amp/ESP32/relay for media-pipeline experiments.
