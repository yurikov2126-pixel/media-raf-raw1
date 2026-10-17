# Radio 2.0 — continuous station playout worker, phase 2 (testing only)

## Implemented
- Separate Node.js process `server/workers/radioPlayout.js` uses one **persistent FFmpeg MP3 encoder** and streams its output to multiple listening connections. It follows approved server timeline by track/time offset. Empty slots output silence. No per-listener encoder instances.
- Local worker HTTP listens on `127.0.0.1:4105` only, protected by a shared secret. Node API proxies the stream through existing authenticated `GET /api/radio-agent/agent/stream` (Bearer RadioDevice token and PILOT enabled). Admin `GET /api/radio-agent/dashboard/worker` reports state.
- Dashboard shows worker health and connected listeners; previous widgets preserved.

## IMPORTANT limitations
- Remote host microphone WebRTC **is NOT mixed into this stream yet**. It remains available through the earlier separate browser-to-Mac pilot. Do not claim a merged direct broadcast.
- Switching scheduled files is experimental, may include gaps. It should be stress-tested across track and slot boundaries. No Loudness normalization, no station jingles, no recording, no listener reconnect / crossfade in client.
- Mac/Windows agent currently **does not consume** `/agent/stream`; local automatic failover is a separate stage.
- The worker only binds loopback but the Express proxy is publicly reachable by authorized devices.
- Amp/ESP32 emergency broadcast interfaces remain disconnected.

## Ubuntu 24.04 / aaPanel installation
First verify:
```bash
node --version
command -v ffmpeg
ffmpeg -hide_banner -encoders | grep libmp3lame
```
Node and FFmpeg must be accessible to the systemd service user, and the worker must have read access to `RADIO_ASSET_DIR` (same location used by the API). Install FFmpeg using `sudo apt install ffmpeg` only if missing.

Generate a long random secret, store **the exact same value** in the API and worker environment (never commit it):
```bash
openssl rand -hex 32
```
Example environment variables for both services:
```ini
RADIO_PLAYOUT_ENABLED=true
RADIO_PLAYOUT_PORT=4105
RADIO_PLAYOUT_SECRET=<private random hex secret>
RADIO_ASSET_DIR=/path/to/private/radio-audio
RADIO_FFMPEG_PATH=/usr/bin/ffmpeg
```
Enable the API flag only once the worker is healthy. Do not expose port 4105 through aaPanel/nginx, firewall or NAT.

Copy `docs/systemd/mediaraf-radio-playout.service.example` to your own systemd directory, customize `User`, `WorkingDirectory`, `EnvironmentFile` and install it **only after successful local test**:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mediaraf-radio-playout.service
sudo systemctl status mediaraf-radio-playout.service
journalctl -u mediaraf-radio-playout.service -n 100 --no-pager
```

Then restart the API using your project's normal deploy procedure and check Radio → Dashboard. Test protected endpoint with a pilot device token in an Authorization header, never in query URL. The endpoint is a long-running audio response; test with a short bounded read, not an unbounded curl to a terminal.

## QA gates
- Node syntax check `node --check server/workers/radioPlayout.js`, `node --check server/src/lib/radioWorkerProxy.js`.
- Confirm only loopback: `ss -lntp | grep 4105`.
- No worker: dashboard clearly says unavailable, API stream returns 503.
- No approved slots: encoded silence; no crash after 10 minutes.
- Scheduled assets and intervals: timing, track transitions, listen for glitches, playback offset alignment.
- Two authorized listeners share one encoder; third-party/no token 401, revoked token 401, SYNC_ONLY 403.
- Kill/restart worker and check Dashboard heartbeat and recovery.
- PWA desktop/mobile responsive status, dark/light contrast.
- No hardware hookup until primary stream and local fallback have been exercised and fail-safe independently verified.
