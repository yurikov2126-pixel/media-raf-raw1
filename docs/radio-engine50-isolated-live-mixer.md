# Radio 2.0 — Audio Engine 5.0: isolated PCM Live Mixer

## Delivered
- Pure 48 kHz stereo signed 16-bit, 20 ms / 3840-byte PCM mixing.
- Configurable music gain, voice gain and music ducking when voice is present; integer saturation prevents clipping wraparound.
- Bounded sequential voice queue with strict 960-frame index increments. Gap, overflow and authorized voice underrun fail closed.
- An offline schedule-first harness: unknown schedule/active scheduled slots never admit voice. Voice in an offline simulation needs explicit consent, valid lease, and healthy PCM.
- Deterministic tests for arithmetic, clipping, failed voice, absent schedule authority, source priority, queue bounds and cancellation/reset.

## Non-goals / safety
This module is **not wired to the actual Worker, FFmpeg decoder, public MP3 encoder, audio listener, Auto-DJ or live schedule**. The result is an in-memory PCM Buffer for offline tests only. No radio station source selection or physical output is changed. `connectedToEncoder:false` and `changeApplied:false` are invariants of the harness.

The test harness's `authority` object is only an injected test input. It is **not** trusted authorization in production. Before any future live output integration, verify authority from PostgreSQL at the audio output boundary, use Worker-owned session fencing and schedule revision checks, ensure a production output playout buffer, audio clock continuity, and comprehensive isolated fault injection.

## Test before merge
`cd server && npm test -- radioIsolatedLiveMixer` and the full server suite/lint. Run client build and verify the existing public MP3 station remains unchanged. No migration, environment flag or deployment wiring is included. Do not connect school PA/amplifiers/ESP32 relays to experimental audio.
