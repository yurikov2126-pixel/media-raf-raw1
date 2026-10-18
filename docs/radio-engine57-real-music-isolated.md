# Audio Engine 5.7 — isolated real music sample + voice

This PR replaces the 440-Hz synthesized backing tone in the **private** live PCM monitoring path with an optional pre-decoded music excerpt. It does **not** read the public Auto-DJ playout or its playlist and does **not** switch the public MP3 encoder.

## Preparing the test asset
Use a music file that your station has permission to play. On an isolated test host, decode 20 seconds to 48kHz stereo signed 16-bit PCM:

```sh
ffmpeg -hide_banner -loglevel error -i licensed-test-track.mp3 -t 20 -ac 2 -ar 48000 -f s16le private-music-test.pcm
```

Ensure file length is a nonzero multiple of 3840 bytes and at most 5,760,000 bytes (30s). Files larger than the cap are rejected *before being read*. Use a dedicated staging path, **not** the public radio asset directory.

## Opt-in flags (staging only)
All prior isolated PCM flags remain necessary:
- `RADIO_LIVE_PCM_INTAKE_ENABLED=true`
- `RADIO_PRIVATE_LIVE_MONITOR_ENABLED=true`
- `RADIO_ISOLATED_MIX_OUTPUT_ENABLED=true`
- `RADIO_ISOLATED_REAL_MUSIC_ENABLED=true`
- `RADIO_ISOLATED_MUSIC_PCM_FILE=/absolute/path/private-music-test.pcm`

The last two flags default OFF. Invalid or missing test music fails Worker initialization explicitly, rather than quietly playing unrelated audio. The existing ADMIN-presenter `Слушать тестовый микс` headset monitor then plays music + actual Opus-decoded microphone PCM with the prior ducking algorithm, over the *isolated, bounded* private output only. When disabled the old synthetic tone behavior remains.

## Critical limits
- The backing PCM file is loaded into isolated process memory only and loops on sample boundaries. The source is **not** synchronized to live Auto-DJ, does not honor tracks or radio schedule for broadcast, and is not a music-to-voice automatic crossfade.
- There is no Worker output-boundary commit, live fallback actuation or production MP3 routing. School PA/amplifier/Windows Agent/ESP32/relay must stay disconnected during test.
- Run server tests, lint, client build and hardware-isolated Mac/Windows RØDECaster listening tests; 30min soak / USB unplug / dropouts / session restart. Results are not yet confirmed.
