# Mac Radio Agent — central MP3 with cached schedule failover (headphones pilot)

This PR adds a **separate opt-in mode** to the existing Tk Mac agent. It does NOT modify the site dashboard, radio server, WebRTC pilot, amplifier, relay, ESP32, or emergency broadcast interfaces.

## How it works

- The Radio Agent authenticates with its **RadioDevice bearer token** and fetches the shared station MP3 via `/api/radio-agent/agent/stream`.
- VLC connects to a randomly allocated **loopback-only** HTTP relay on Mac. The relay adds the token in an upstream Authorization header; it is never added to a playlist URL.
- During an outage, upstream inactivity/error causes central VLC to stop. The local fallback chooses the **currently scheduled track and offset** from a cached, SHA-256-verified snapshot, rather than beginning a playlist from track 1.
- The controller checks upstream again and returns to central radio after bytes are available. It does not restart interrupted scheduled slots from zero.
- Local snapshot synchronization is run in a background thread and never intended to block the stream watchdog. The snapshot must be synced before relying on an outage.

## Install and first test on Mac (headphones only)

1. Merge/deploy server PR #381 first and verify Ubuntu worker is healthy, with a real approved schedule.
2. Update Mac agent files from this PR. Use existing Python environment; no new packages beyond those required by existing agent.
3. Connect the device with its RadioDevice token; allow pilot playback in the admin Radio equipment settings.
4. Click **Синхронизировать файлы** and wait for completion. Ensure the currently active slot is cached.
5. Stop any local mic, WebRTC receiver, scheduled pilot or audio check. Click **Включить центральный эфир** and confirm headphones-only. Its status messages appear in the GUI log.
6. With an approved slot, verify audible music and correct time position. Disconnect Wi-Fi for a short period; expect `FALLBACK` and `LOCAL_TRACK <id> offset <seconds>`. Reconnect; expect `PRIMARY_STREAM` and central playback to resume.
7. Repeat three times, and test next-track/slot boundaries. Stop via **Остановить центральный эфир**. Check no VLC child remains.
8. Verify device revocation or disabled playback terminates the mode. Leave amplifier disconnected.

## Important limitations / remaining release gates

- This is an experimental pilot **not** production-ready or suitable for unattended school PA.
- The remote microphone remains a **separate WebRTC pilot** and is **NOT** included in the central MP3. The GUI prevents simultaneously starting the two modes to avoid duplicate sound.
- There can be a silence gap during reconnect, and HTTP/VLC buffering adds latency. No crossfade, jitter smoothing, hard real-time audio guarantee or central mixing yet.
- Offline fallback depends on an already downloaded schedule and cache. If files are missing, stale, corrupted or the local Mac clock is wrong, playback will be unavailable or mistimed; the agent does not invent content.
- Radio stream probe/relay creates additional short-lived connections; monitor worker `connected` and server load.
- Verify no overlap with WebRTC/mic/audio-test, test authorization expiration, listen for gaps across track boundaries, and run repeated simulated Wi-Fi loss tests before enabling automatic OS start.
- Existing local pilot mode is preserved for regression tests; do not start it concurrently with this mode.
