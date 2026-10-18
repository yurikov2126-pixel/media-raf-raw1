# Radio 2.0 — Audio Engine 4.7 (isolated handover control plane)

## What this PR adds

An authenticated ADMIN Socket.IO dry-run control plane:
- `radio:studio:handover:prepare`: compile a server-side observation and prepare a 3-second fenced proposal.
- `radio:studio:handover:verify`: re-read PostgreSQL and isolated Worker status; re-check presenter ownership, lease and schedule fingerprint.
- `radio:studio:handover:cancel` and `radio:studio:handover:journal`: cancel the proposal and inspect a bounded history.
- Browser presenter panel for prepare / verify with unmistakable **no broadcast switch** labeling.

Inputs come from the existing admin socket, server-side gateway ownership, the authenticated Worker loopback status endpoint and approved schedule queries. There are no new public HTTP endpoints, secrets or audio output connections.

## Safety limitation: not a production source-switching authorization

The revision used for this **dry-run only** is derived from a SHA-256 fingerprint of future approved schedule slots, encoded as a safe integer for the existing preflight API. It is NOT a monotonically increasing database revision. An ABA change-and-revert, a change to playlist content, or a concurrent write between reads is not guaranteed to be detected. Do **not** wire its result to the station MP3 encoder or a real source switch.

The PCM readiness is based on the **shadow** simulator, not an output-boundary buffer. Verification still returns `changeApplied:false` and `connectedToEncoder:false`; no automatic fallback or Windows Agent/ESP32 control is introduced.

Next requirements before live handover: transactional database sequence incremented on all relevant schedule/playlist mutations; explicit server-controlled presenter lease; authoritative output-boundary PCM buffer; Worker-side compare-and-switch under lock with immediate schedule recheck and fallback testing.

## Verification

Run server tests `npm test -- radioHandover`, full suite and lint; build client; exercise two competing admins, 3-second expiration, Worker unavailable, DB failure, changed schedule, disconnected presenter and repeat start/stop. Experimental PCM flags must remain disabled on the production station; use isolated audio monitoring only with school PA/amplifier/ESP32/relay physically disconnected.
