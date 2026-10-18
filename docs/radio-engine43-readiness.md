# Radio Audio Engine 4.3 — presenter readiness diagnostics

A pure, read-only evaluator `evaluateRadioPresenterReadiness` projects Worker `/live-pcm/status` shadow signals and the existing schedule-first policy into diagnostics: recommended source, precise blockers, buffered duration, PCM age and `changeApplied:false`.

Inputs must come from authenticated server state and the **loopback** Worker, never from client-provided status. Missing, stale or failed shadow telemetry is NOT READY.

This stage deliberately does **not** call the Worker from inside the evaluator, add a public route, switch the station encoder, alter schedule or attempt fallback. The intended future caller is an authenticated server-only monitor.

## Important caveat
The Audio Engine 4.2 shadow consumes and discards frames. It is NOT the real station playout buffer. Even `diagnosticReady:true` is only laboratory readiness and MUST NEVER authorize an MP3 source switch or be exposed as “on air”. Production readiness will require an authoritative output buffer, lease fencing, schedule revalidation at commit, and staged failure injection testing.

## Tests
Run `cd server && npm test -- radioPresenterReadiness`, full server tests and lint. Validate absent telemetry, stalled PCM, inactive session, failed shadow, insufficient buffer and schedule priority. All pilot flags stay disabled on production and tests must never connect PA/amplifier/ESP32/relay.
