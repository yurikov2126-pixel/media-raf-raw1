# Audio Engine 4.1: isolated timed PCM playout simulator

A deterministic, manually ticked PCM playout buffer. This is not a production scheduler or a new audio output. No timer runs automatically; tests advance a supplied clock. Frames never reach the MP3 encoder, relay, PA, or public stream.

## Contract
- Signed stereo 48 kHz / 16-bit PCM, one 3840-byte frame each 20 ms.
- Five-frame (100 ms) minimum prebuffer by default, at most 50 frames (1 second).
- Strict sequential 960-sample frame indices. Duplicates, gaps and overflow fail closed.
- A buffer underrun, stale input or missed playout deadline stops output. No concealment, generated silence or replay.
- Explicit `reset()` required after failure; no automatic restart or source change.
- `tick(nowMs)` returns at most one audio frame, intended only for isolated simulation harnesses.

## Critical separation
This is a **standalone pure simulation**, not wired to the ingress pipeline from Audio Engine 4.0 or the actual Worker. Its bufferedMs value is not production-ready telemetry and must not be supplied to live source arbitration yet.

## Test plan
Run `cd server && npm test -- radioTimedPcmPlayout`, full server tests and lint. Check time advance, prebuffer, failures and reset. Any real-time timer-based Worker integration requires its own isolated test with headphones only; never attach school PA/amplifier/ESP32/relays.
