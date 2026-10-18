# Audio Engine 4.4 — read-only live studio diagnostics

The authenticated admin browser studio polls `radio:studio:health` via the existing authenticated Socket.IO connection every 2.5 seconds. The server checks its current presenter and gateway ownership, and queries the protected loopback Worker `GET /live-pcm/status` using the server-only secret. The UI receives only sanitized booleans, latency estimates and readiness blockers.

This is **monitoring only**, not a public endpoint or live audio source. No Worker token or secret is sent to the browser. Unreachable Worker and missing telemetry display as unavailable, never ready.

## Safety policy
Actual scheduled-broadcast state has not yet been attached to this health query. To prevent a false “ready for air” signal, the server deliberately supplies `scheduledActive:true` to the diagnostic evaluator and adds `SCHEDULE_AUTHORITY_UNAVAILABLE`. The status is not a permission to switch MP3 sources. `changeApplied:false` and `liveOutputConnected:false` are invariant.

## Check before merge
- Run client build and lint, server tests and lint.
- Confirm non-admin users do not receive the Socket.IO diagnostic event.
- Confirm the panel renders unknown data without displaying a healthy status.
- Disconnect Socket.IO and verify stale data disappears.
- In isolated staging only, enable the previous PCM pilot flags and verify Worker health telemetry; do not connect PA, amplifiers, ESP32, relay or other hardware output.
- A later PR must integrate authoritative schedule state and an actual output playout buffer before implementing source handover.
