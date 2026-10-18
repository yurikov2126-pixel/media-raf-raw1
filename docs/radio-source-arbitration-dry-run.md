# Radio 2.0: broadcast source arbitration policy (dry run)

This stage adds **only** a deterministic, testable source recommendation. It does not wire a broadcaster, switch the MP3 encoder, activate a live channel, or command hardware.

## Priority

1. When a scheduled slot is active and its source is ready, recommend `SCHEDULE`, regardless of presenter state.
2. When a scheduled slot is active but its scheduled media is not ready, recommend `AUTO_DJ` as a safe fallback, **not** an unscheduled presenter takeover.
3. Outside scheduled slots, recommend `PRESENTER` only when authenticated/authorized, connected, gateway running, PCM timestamp recent (at most 1.5 s old), and PCM buffer >= 100 ms.
4. In any other case, recommend `AUTO_DJ`.

Every response includes `changeApplied: false`. The results are proposals, not authoritative on-air state.

## Integration still required before switching any audio

- The gateway currently counts PCM frames but has not implemented an actual playout jitter buffer or authoritative `pcmBufferedMs` measurement. Do not use packet count as a substitute for audio readiness.
- The playout worker must provide an authoritative scheduled-active flag and scheduled source readiness; never derive it from browser claims.
- Add lease fencing/generation identifiers before connecting a real source. Any decision must be re-validated at the audio handover boundary to prevent a stale presenter from stealing the output.
- Explicit operator permission, short muted preflight, a monitored switching window, and instant Auto-DJ rollback are prerequisites for future on-air integration.
- Production flags remain disabled. Test solely on an isolated Worker using headphones, without school PA/amplifier/ESP32/relay.

## Verification

Run `cd server && npm test -- radioSourceArbitrationDryRun`. Confirm schedule-first, fail-closed fallback, future/stale timestamps, buffer threshold, and non-mutating policy behavior. Then run server lint and full tests before merging.
