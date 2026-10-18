# Radio 2.0 — Audio Engine 4.6: fenced handover preflight (dry run)

This stage adds a two-phase, **non-mutating** handover decision machine and single-operator coordinator. They have no Socket.IO command, HTTP listener, or audio encoder callbacks, and cannot switch an audio source. They are a prerequisite to a future isolated audio handover, not the handover itself.

## Policy contract

- Before preparing a presenter takeover, the server must supply a trusted snapshot with known schedule, no active approved scheduled slot, authorized and connected presenter, healthy gateway and PCM, an immutable presenter identity, lease ID, and monotonically controlled schedule revision.
- `prepare(snapshot)` issues a short-lived random token (default 3 seconds). This token is a **local proposal identifier**, not a bearer permission for on-air routing.
- `validate(token, freshSnapshot)` checks the current schedule and PCM status again and rejects expired tokens, a switched presenter, a new lease, or any schedule revision change.
- `invalidate(reason)` cancels outstanding proposals; `failover(reason)` records a *recommendation* to retain/return to Auto-DJ, not an executable command.
- Single-operator coordinator rejects conflicting owners, provides cancellation, and revokes pending proposals on presenter loss.
- Bounded journal (100 items by default) records decisions without persisting audio data, secrets or bearer tokens.

## Integration blockers before public output

This code is not wired to `radioStudio` or `radioPlayout`. The system currently has no authoritative per-change schedule revision nor safe production PCM output buffer/fenced commit primitive. It would be unsafe to invent those from a snapshot timestamp or the existing shadow PCM simulator.

Before a follow-on production handover, implement a transactional schedule revision maintained on each relevant write, acquire a strong presenter lease, build an output-boundary buffer, revalidate at commit time in the Worker, and test simultaneous schedule changes, overrun, network cut and restart. Then add explicit restricted server-only commands and a hardware-isolated pilot.

## Tests and release

Run `cd server && npm test -- radioHandover` and `npm run lint`, followed by the full suite and a client build. The API currently has zero on-air impact: no public MP3 switch, no hardware commands, and no new environment flags. Keep experimental Worker intake settings disabled on production and test using headphones only, disconnected from PA/amplifier/ESP32/relay.
