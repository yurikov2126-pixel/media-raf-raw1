# Audio Engine 5.1 — real PCM isolated mixing lab

## Purpose
Exercise the existing browser Opus → FFmpeg decoder → Worker PCM intake → timed playout buffer → actual arithmetic mixer **without** routing any mixed PCM to the MP3 encoder. Synthetic 440 Hz music is generated only in the lab, never sent to public listeners.

## Strict isolation
The new Worker lab requires ALL three explicit opt-ins:
- `RADIO_LIVE_PCM_INTAKE_ENABLED=true`
- `RADIO_TIMED_PCM_SHADOW_ENABLED=true`
- `RADIO_PCM_MIX_LAB_ENABLED=true`

The third flag defaults to OFF; it has no effect without the two earlier flags. It adds **no HTTP route or audio output**. Existing loopback, secret-authenticated `/live-pcm/status` includes `pcmMixLab` with counters, latest fault, peak level and checksum, but NEVER raw audio or an output buffer. Status always contains `connectedToEncoder:false` and `changeApplied:false`.

## Lab behavior
- Every correctly admitted 3840-byte, 20-ms stereo 48-kHz signed PCM voice packet is copied into a bounded, independent timer-driven queue.
- Existing 20-ms Worker shadow timer advances the lab. The PCM frame is mixed with synthetic stereo test music and immediately discarded, leaving only aggregate metrics.
- Queue sequence gap, stale producer, buffer overflow, timer overrun or underrun halts that lab session. No sample concealment, burst playback, silent restart or output connection.
- Session start/end clears old buffers and telemetry.
- If the lab fails, existing Auto-DJ / scheduled output is never changed.

## Verification gate
Before merge run `cd server && npm test -- radioIsolatedPcmLab`, the full Vitest suite, ESLint and existing Worker tests. In an isolated replica run browser Opus and verify lab frames/checksum while checking the public `/stream` does not change. Simulate late audio, stopped mic, rapid session reset and network loss.

**Do not enable these pilot flags on the production radio worker.** Keep the school PA, amplifiers, Windows Agent, ESP32 and relays physically disconnected during trial. This does not implement output-boundary atomic source switching, authoritative real-time schedule commit or Auto-DJ fallback actions.
