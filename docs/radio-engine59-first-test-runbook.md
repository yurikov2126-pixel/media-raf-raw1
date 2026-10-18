# Radio 2.0 — Test-First milestone 5.9

Goal: start validating what exists instead of adding another isolated algorithm without real evidence.

## 1. Merge + deploy to a SEPARATE STAGING worker
- Do not use the production Worker, Windows Radio Agent, school loudspeakers, amplifier, ESP32 or relay.
- Confirm `RADIO_PLAYOUT_SECRET` is set on staging, both Node and FFmpeg are installed and the isolated browser studio is reachable over HTTPS.
- Use the RØDECaster Duo as USB audio input on macOS Chrome (then Windows Chrome/Edge), with headphones and mix-minus.

## 2. Run preflight and deterministic soak
```sh
cd server
npm test
npm run lint
node scripts/radio-isolated-soak.mjs 90000
node scripts/radio-staging-preflight.mjs
```
The 90,000-frame soak is **30 minutes simulated audio time**, not a 30-minute realtime network test. It consumes zero real microphones and cannot verify USB, MediaRecorder, FFmpeg, jitter, deployment, hardware or public stream continuity.

## 3. Follow the new Studio checklist
Select the correct USB input, visually check stereo levels, join as ADMIN presenter, start `Тест передачи Opus` and check server health. Make a private WAV snapshot, then listen with the separate live PCM and mixed audio monitor. The UI intentionally keeps all production switching disabled. Disconnect USB, sleep/wake Mac, interrupt the network, and confirm audio stops and sessions close. Record errors and screenshots.

## 4. What counts as first real test
- At least two computers (presenter + separate headphone-only listener), one RØDECaster, no speaker/PA output.
- Session starts; stereo microphone signal reaches Worker; private PCM and mixed monitor audible; no unexpected echo or loss.
- Worker rejects or closes stale input; no old audio is replayed on reconnect.
- Public `/stream` and Auto-DJ continue unaffected.
- Document server OS/versions, audio routing, observed latency and failure cases.

**This is not authorization for school broadcast.** A real on-air output-boundary commit, playlist handover, failover actuator and longer realtime soak are still missing. If the tests fail, treat that as a blocker and fix it before enabling any public transmission.
