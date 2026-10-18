# Audio Engine 5.6 — isolated audible live mixer

A separately flag-gated test mixes decoded browser/RØDECaster Duo microphone PCM with a synthetic 440-Hz backing tone using the existing Audio Engine 5.0 ducking function. The result enters a private bounded PCM queue and can be played through the existing admin-presenter headphone monitor.

**This is not Auto-DJ integration.** The backing music is an artificial tone only, for testing timing and mixing. The public station MP3 encoder, music source selection, schedule, Windows Agent and school PA/amp/ESP32 are untouched.

## Gate
Worker must already use `RADIO_LIVE_PCM_INTAKE_ENABLED=true`, `RADIO_PRIVATE_LIVE_MONITOR_ENABLED=true`, plus newly `RADIO_ISOLATED_MIX_OUTPUT_ENABLED=true`. All test flags must be enabled **only on an isolated environment**. The new endpoint `/live-pcm/private-mix` is loopback and shares Worker secret authorization. The socket forwarding event requires current admin presenter + working gateway.

## Trial checklist
1. Test branch on non-production Worker with physical PA disconnected.
2. Select RØDECaster Duo USB stereo in Chrome on Mac; configure mix-minus and use headphones.
3. Start presenter and test Opus uplink, then press `Слушать тестовый микс`.
4. Confirm synthetic music tone becomes quieter under live voice input; this is an intentionally synthetic reference signal, not real Auto-DJ.
5. Verify disconnection, session reset, slow browser playback and stale PCM stop the monitor; public /stream and scheduled shows are unchanged.
6. Run `cd server && npm test -- radioIsolatedMixOutput`, full server tests, lint and client build before merge.

## Remaining work
Atomic Worker source selection with PostgreSQL revision + session fencing, real Auto-DJ-to-live crossfade, hardware-isolated end-to-end quality tests, an operational fallback with bounded latency, and authoritative acceptance checks. Do not treat this headset audition as permission to begin a public or school broadcast.
