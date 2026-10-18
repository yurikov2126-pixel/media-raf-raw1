# Radio 2.0 — isolated live browser Opus → FFmpeg → PCM Worker

## Safety boundary
This is an opt-in **isolated PCM intake pilot**, not a live station cutover. The Worker accepts authenticated PCM but does **not** route it to the station MP3 encoder. The original peer-to-peer WebRTC studio and the radio schedule keep their existing behavior. Do not connect school PA, power amplifiers, ESP32 relays or other physical outputs during testing.

## Pipeline
Browser MediaRecorder (continuous WebM/Opus) → ordered Socket.IO acknowledgements → authenticated admin studio → server-only FFmpeg decoder → stereo 48 kHz signed 16-bit PCM → 20 ms numbered packets → authenticated HTTP loopback `127.0.0.1` Worker PCM session → discard/diagnostics.

No Worker secret or PCM session token is sent to the browser. No public HTTP ingest endpoint is added.

## Opt-in configuration (isolated staging only)
- `RADIO_BROWSER_OPUS_UPLINK_ENABLED=true` enables the existing validation-only browser transport.
- `RADIO_BROWSER_PCM_GATEWAY_ENABLED=true` enables server-side FFmpeg and Worker forwarding. Requires browser transport flag as well.
- `RADIO_LIVE_PCM_INTAKE_ENABLED=true` on the isolated Worker enables its loopback intake.
- `RADIO_PLAYOUT_SECRET` must match the Worker and be at least 32 characters; `RADIO_PLAYOUT_PORT` is the isolated local Worker port.
- `ffmpeg` must be installed on the server.
All flags default to disabled. Never expose `/live-pcm/*` via nginx.

## Guardrails
- One presenter and one uplink session, sequenced input, max 128 KiB per Opus chunk.
- Browser-side 8-entry bounded FIFO, 5-second ACK timeout and fail-closed behavior (dependent on PR #435).
- Gateway limits pending FFmpeg input to 512 KiB; a stalled input terminates the session.
- Worker packetization and PCM frame index contract reused from PR #433.
- Worker requests use only loopback, shared server secret, per-session token and a 3-second timeout.
- Disconnect, leave, invalid chunk, Worker error and FFmpeg failure trigger session cleanup.
- PCM intake still cannot select the broadcast audio source.

## Verification
1. Merge/verify PR #435 first. Apply this PR only in an isolated staging environment, with headphone monitoring and physical outputs disconnected.
2. Run `cd server && npm test -- radioLiveOpusGateway` and existing radio gateway suites; run `npm run lint`.
3. With all opt-ins disabled verify normal studio WebRTC and Auto-DJ do not change.
4. Enable the three flags on an isolated Worker/server and start browser presenter with WebM/Opus support. Press `Тест передачи Opus`.
5. Verify `/live-pcm/status` reports sequential frames. The output must NOT appear in the public MP3 station.
6. Disconnect browser and separately stop FFmpeg/Worker; verify the UI stops its pilot, the session is revoked and regular Auto-DJ is unaffected.
7. Validate FFmpeg process termination, Socket.IO ACK delays, repeated start/stop, packet-order rejection and resource limits.

## Future independent stages
Explicit jitter/loss concealment and time-based PCM playout control; per-session lease/heartbeat; production-safe source arbitration with schedule priority; public MP3 encoder integration; independently tested Windows failover. Do not enable any of these merely by switching on the pilot flags.
