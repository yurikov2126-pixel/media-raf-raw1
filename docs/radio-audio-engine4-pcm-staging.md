# Audio Engine 4.0 — isolated PCM ingest staging and telemetry

This change provides an ordered, bounded **ingress staging** helper and integrates it into the browser Opus → FFmpeg → loopback Worker gateway. It is not a timed playout jitter buffer.

- Strict 3840-byte stereo 48kHz s16le frames, consecutive 960-sample indexes, configurable max 50 frames (= 1000ms memory budget).
- Tracks freshness, frame accounting, discontinuity and overflow. On error the queue is cleared rather than replaying or padding samples.
- Gateway stages one frame before a Worker ingest HTTP request, and removes it only after successful acknowledgement. This makes the staging an in-flight measurement, not a reliable measure of audio available for playback.
- No new public socket or endpoints, no access to the station MP3 encoder, no source selection, no automatic hardware control. Production pilot flags remain off by default.

**Caveat:** `pcm.bufferedMs` in gateway status reflects only in-flight PCM being sent to Worker. It MUST NOT be used as the `pcmBufferedMs` input of the source arbitration policy. That requires an authoritative timer-driven playout buffer living at the audio output boundary. Do not enable presenter takeover based on this metric.

Before merging run `cd server && npm test -- radioPcmStaging`, run server lint and existing gateway tests. Test only with headphones on an isolated Worker disconnected from school amplifier, PA, ESP32 and relay.
