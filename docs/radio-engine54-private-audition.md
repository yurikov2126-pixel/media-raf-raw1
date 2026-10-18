# Audio Engine 5.4 — private PCM audition for RØDECaster Duo (macOS / Windows)

This PR adds the first *audible server-received PCM* check, not a live radio stream. It captures at most the latest 50 accepted 20-ms stereo PCM frames (1 second) **only when** both `RADIO_LIVE_PCM_INTAKE_ENABLED=true` and `RADIO_PRIVATE_PCM_PREVIEW_ENABLED=true`. The second flag is OFF by default.

A current ADMIN presenter with an active isolated Opus/FFmpeg gateway can request a snapshot in the browser studio. The protected, loopback-only Worker returns a WAV fragment through an ADMIN-only Socket.IO callback. Users can listen to the result with headphones; the Worker has no additional public port or MP3 encoder connection.

## Steps for isolated smoke test
1. On staging only, enable the existing browser Opus PCM gateway and Worker intake flags, plus `RADIO_PRIVATE_PCM_PREVIEW_ENABLED=true` on Worker. Do NOT connect PA, speakers/amplifier or ESP32.
2. Connect RØDECaster Duo via USB to Mac, choose its Main stereo capture as the browser input and verify L/R meters.
3. Join as current admin presenter, start the existing `Тест передачи Opus`, speak for more than 1 second.
4. Press `Получить тестовый WAV-фрагмент`, listen using isolated headphones.
5. Stop the presenter and verify preview becomes unavailable. Repeat with USB unplug, network loss, failed Worker and different browser input.
6. Verify Auto-DJ and public `/stream` output are unchanged. Test on Windows separately.

This short snapshot is *not* continuous playback, is not a music/voice mix, and isn't accessible to radio listeners. Captured data is kept in an in-memory bounded queue, cleared when a Worker intake session starts/ends. Worker requests require the existing 32+-character secret and client requests require the current admin-presenter socket and gateway ownership.

**Next**: only after this passes, implement a continuously playable *separately isolated* stream, Worker-side authoritative schedule/lease commit and fault-injection tests. Public on-air source switching remains disabled.

## Validation
Run `cd server && npm test -- radioPrivatePcmPreview`, the full test suite and lint, and client build/lint. No CI/hardware listening was executed during PR authoring.
