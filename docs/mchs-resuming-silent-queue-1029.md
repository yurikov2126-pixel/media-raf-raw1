# Production incident 07.11.2026 — queued ALL-CLEAR behind silent RESUMING

After real missile DANGER an operator reported no PA amplifier ON, and later heard ALL-CLEAR in Windows Agent but not browser. Admin screenshot at 01:49:47 MSK showed prior DANGER: START_ACCEPTED, last PCM: RESUMING, and later ALL-CLEAR: STAGED. That is **not evidence** that ALL-CLEAR PCM reached the main Radio Worker encoder: the queued status explicitly shows that START had not yet been accepted on the main station at that snapshot.

## Confirmed code-level blockage

The main Worker priority lifecycle enters RESUMING when the last alert PCM frame is written. Until the regular audio path yields a **nonzero PCM frame**, it does not call `restored`. If the next legitimate AutoDJ/schedule source is silence (idle period), RESUMING can last indefinitely, while the sequential Android dispatcher treats RESUMING as busy and blocks the next alert. The radio can be intentionally idle and silent, so this assumption is incorrect.

## Contained repair

After the last ALARM PCM frame, the existing Worker sees subsequent real encoder-input program frames. If a non-silent frame is received before timeout, terminal COMPLETE is recorded with actual return evidence as before. If the post-alert program path emits **five seconds of 48kHz PCM16 stereo silence**, the session transitions to terminal FAILED with reason `SILENT_PROGRAM_RETURN_TIMEOUT` and `naturalCompletion:true`, `programRestored:false`. Its durable terminal journal records failure, and the sequential dispatcher is no longer blocked by a permanently active RESUMING session. This does **not** re-label silence as successfully audible normal programming or replay an ALARM. The next fresh, already-staged ALL-CLEAR can be considered by the existing dispatcher and Worker. To prevent a recovered Worker from announcing an obsolete ALL-CLEAR long after the real event, STAGED/QUEUED requests older than **10 minutes from Android occurredAt** are now marked EXPIRED with `EVENT_TOO_OLD_FOR_LIVE_BROADCAST`; no alert audio is started from those rows. This is a bound on delayed station admission, not on completing a file that already started.

This is a containment fix for blocked queue, **not** proof that internet listeners heard the alert or that PA GPIO13 was energized. Those need inspection of the browser player transport and the Windows Agent power-intent/ESP32 telemetry. Do not create fake emergency inputs in production.

## Deployment

Update and restart `mediaraf-radio-playout.service` via normal deploy after CI. Verify Worker runtime build rather than relying solely on repo HEAD. Do not restart an actively playing emergency session except where incident response explicitly requires it, and do not treat stale historical events as fresh. Track `SILENT_PROGRAM_RETURN_TIMEOUT` as an operational failure, even though it releases the sequential queue.

## Tests

`node --test server/tests/mchsStationPcmExecutor.test.js` includes a silent five-second program return, terminal failure evidence, a subsequent ALL-CLEAR admission, and a successful non-silent program return before timeout.
