# Radio 2.0 Audio Engine 4.9 — Worker-side source switch rehearsal

## Implemented
- Pure `RadioWorkerSwitchShadow`: two-phase prepare/verify, expiring random proposals, generation counter, lease and schedule revision fencing, bounded journal, advisory Auto-DJ fallback.
- Pure `inspectRadioOutputBoundary`: conservative admission checklist for an isolated future output-boundary test (approved schedule clearance, consistent revision, live session lease, ready buffered PCM and recent frames).
- Worker lifecycle observer: when an isolated PCM session is replaced or terminated, the shadow cancels its proposal, records event/fallback, and the existing secret-protected `/live-pcm/status` response includes shadow state.
- Tests: concurrency-independent state validation, revision/lease change, expired proposals, scheduled show precedence, stale PCM and failure journal.

## Important boundary
This is **not** a real Worker source switch. The Worker does not expose a prepare/verify/commit endpoint, does not invoke `switchShadow.prepare` for on-air routing, does not feed PCM into the MP3 encoder, and never changes the radio output. `canSimulatePresenter:true` is not a production permission. `connectedToEncoder:false` and `changeApplied:false` are invariant.

A full handover still requires a Worker-owned timer-driven output buffer, atomic schedule/lease verification within the actual audio commit transaction, session generation fencing across restarts, and isolated real-time fault-injection tests. A separate, physical-output-disconnected pilot must precede any installation at school.

## Verify
Run `cd server && npm test -- radioWorkerSwitchShadow radioOutputBoundaryShadow` plus the full suite/lint. Check Worker status with correct secret and isolated intake session lifecycle. Confirm the public MP3 stream, schedule priority and Auto-DJ remain exactly unchanged. Do not enable experimental flags in production until end-to-end review.
