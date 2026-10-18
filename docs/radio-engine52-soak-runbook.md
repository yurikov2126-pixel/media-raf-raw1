# Radio 2.0 — Audio Engine 5.2: isolated soak monitoring

The existing opt-in PCM mixer lab now measures end-to-end diagnostic tick drift and input faults without recording raw audio. No audio output or on-air source routing is changed.

## Observability
The secret-authenticated, loopback-only Worker `GET /live-pcm/status` response now contains `pcmSoak` (enabled only when `RADIO_LIVE_PCM_INTAKE_ENABLED`, `RADIO_TIMED_PCM_SHADOW_ENABLED` and `RADIO_PCM_MIX_LAB_ENABLED` are all true):
- Tick count, elapsed time, deadline misses, worst tick gap, worst tick lateness and bounded p95 lateness.
- Accepted/rejected PCM frames and maximum observed queue duration.
- Last ten sanitized failure reasons; audio data and session credentials are never returned.
- Counters reset on intake session replacement/termination.

These are **wall-clock measurements for the isolated simulator**. They are not end-to-end listener latency, production underrun telemetry or proof that live streaming is safe. A 20-ms Node.js interval is not a hardware audio clock; under load, genuine scheduling delays are expected and must be evaluated.

## Test gate
Before enabling on an isolated system:
1. Run `cd server && npm test -- radioPcmLabSoakTelemetry`, full server tests and lint.
2. Run a >=30-minute local soak with controlled PCM frames and record max/p95 lateness, frame rejection, underrun and memory growth.
3. Repeat with network disconnect, late frames, repeated session creation, paused browser microphone and high server CPU.
4. Verify /stream and Auto-DJ remain unchanged; the Worker must not forward any mixed PCM to the MP3 encoder.
5. Never enable lab flags on production or attach school PA, relay, ESP32 or amplifier for these experiments.

Next milestone before a limited on-air pilot: isolated, audible output with explicit hardware disconnection; measured source switch and fallback; Worker-side fenced commit tied to DB revision; repeatable failure injection; a rollback procedure reviewed before station deployment.

## Timeline guidance
A browser-to-browser WebRTC headphones test already exists independently of this new server-to-listener path. A first **server-side** test broadcast requires completing the encoder source connection and failover, validating listening quality and safeguards. No calendar commitment can be supported until integration and actual end-to-end test results are available.
