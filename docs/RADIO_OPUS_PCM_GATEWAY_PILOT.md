# Radio 2.0 — Offline WebM/Opus → PCM media gateway (pilot)

This is an **offline local-file bridge**, not yet a WebRTC server or browser microphone ingestion. It uses FFmpeg to decode a trusted `.webm` Opus test recording to stereo, 48 kHz, 16-bit PCM, assembles ordered 20ms (3840-byte) frames, and sends them to the internal loopback Radio Worker using the previously implemented session token and sample index contract.

## Isolated test (HEADPHONES ONLY)
1. On a test Worker only, enable `RADIO_LIVE_PCM_INTAKE_ENABLED=true` while keeping its normal output disconnected from school PA/amplifier/relay/ESP32.
2. Ensure `RADIO_PLAYOUT_SECRET` and `RADIO_PLAYOUT_PORT` point to this local test Worker, never a public hostname.
3. In the server directory run `node workers/radioOpusGateway.js /absolute/path/to/test.webm`.
4. Review `GET /live-pcm/status` through the internal authenticated service for sequential frames and rejection count. The tool automatically deletes its ingest session.

The Worker **does not feed live PCM into its MP3 encoder**. No actual broadcast/audio handover is enabled. The current WebRTC studio is not wired to this CLI. No new npm dependency or external network endpoint is added. The next stage must explicitly handle authenticated live WebRTC Opus reception, jitter buffering, transcoding, backpressure, session lease and scheduled-broadcast priority; audio source selection must stay disabled until separately tested.

Security: do not publish `/live-pcm/*` through nginx, do not put the Worker secret into browser JavaScript, and never use production PA/school sound equipment for trials.
