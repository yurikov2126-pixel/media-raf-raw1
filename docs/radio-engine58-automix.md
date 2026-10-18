# Audio Engine 5.8 — speech-aware ducking, isolated output only

The private headphone mix now detects signal above a configurable RMS threshold and applies an attack/hold/release envelope to music level. This avoids instantaneous gain jumps and restores music level after the presenter goes quiet.

Default detector: -39 dBFS threshold; attack 100ms; hold 300ms; release 700ms; music duck target 0.28. Exactly one 20ms PCM frame advances the envelope. Levels are per-frame RMS of stereo 16-bit PCM; this is energy detection, **not** speech recognition. Studio noise or jingles in the USB Main mix may trigger ducking.

The output remains private-only and uses the existing isolated music file (or tone) and RØDECaster microphone PCM. This does not connect to Auto-DJ, public MP3 encoder, the school's PA or any station relay.

## Verify before merge
- `cd server && npm test -- radioVoiceDuckingEnvelope`, server full suite/lint.
- Isolated RØDECaster headphone test: speak / pause / remain silent / create background noise and listen for smooth music gain.
- Simulate lost USB connection and verify the private monitor stops without stale playback.
- The sound of the scheduled/public radio playout must remain unchanged.

## Remaining production gates
Real approved schedule authority and session fencing at output boundary; separate encoded listener pilot; controlled source switching, measured return to Auto-DJ and physical sound isolation tests.
