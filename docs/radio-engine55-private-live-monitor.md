# Audio Engine 5.5 — private near-live PCM monitor

This implements continuous **poll-based, near-live** stereo PCM headphone monitoring for the current ADMIN presenter. It is **not** the public MP3 broadcast, nor a guaranteed gap-free low-latency stream.

## Architecture
- Captured 48 kHz stereo signed 16-bit PCM from the existing Opus/FFmpeg gateway enters a bounded memory-only `RadioPrivateLivePcmQueue` (max 75 frames / 1.5 sec). Every frame is 20 ms, sequentially numbered.
- The protected loopback Worker endpoint `GET /live-pcm/private-live?after=<cursor>` returns up to 8 frames as base64, only when `RADIO_LIVE_PCM_INTAKE_ENABLED=true` and `RADIO_PRIVATE_LIVE_MONITOR_ENABLED=true`.
- The ADMIN-only socket event `radio:studio:private-live` checks current presenter ownership and gateway health, proxies only bounded frames through the existing secret-authenticated Worker connection.
- Browser `AudioContext` decodes PCM and schedules sequential 20-ms stereo buffers in headphones. Cursor gaps, stale PCM, backlog, underrun or loss of connectivity stop monitoring rather than silently concealing errors.
- PCM is erased on session start/end. The browser player closes its audio context when stopped or unmounted.

## Safety
**Default OFF**: enable the second flag ONLY on a physically isolated Worker used for testing, never on the existing school PA, public MP3 broadcast or a live station without inspection. The audio stream is private to the current administrator presenter, not accessible to regular site users. A monitor opened on the same USB return path as the captured RØDECaster mix may create a feedback loop. Test exclusively with headphones and correct RØDECaster mix-minus.

This is a near-live polling prototype subject to jitter; it is not production-grade, and it does not output through the Worker MP3 encoder, change schedule priorities or trigger Auto-DJ fallback. A distinct authenticated streaming transport and real output-boundary mixer/clock are future work.

## Acceptance checks
Run `cd server && npm test -- radioPrivateLivePcmQueue`, full server tests/lint, client build/lint. On a disconnected test stand: monitor 30 minutes, test Mac and Windows RØDECaster, browser tab backgrounding, USB removal, network loss, slow reader, concurrent admin sessions and reconnect. Inspect real delay and listener sound. Do not enable for school speakers.
