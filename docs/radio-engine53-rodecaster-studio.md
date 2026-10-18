# Audio Engine 5.3 — RØDECaster Duo / USB input + offline audible mixer proof

## Browser studio
- Works with USB Audio devices exposed by macOS or Windows. Tested *in code only*, not on physical RØDECaster hardware.
- Before starting as presenter choose an audio-input device. Browser microphone permission may be needed before human-readable device names appear.
- For a RØDECaster Duo choose the correct USB stereo Main / Mix device as exposed by the OS; actual names depend on firmware/routing. Stereo input is requested as a preference, not assumed as guaranteed.
- Hardware mixer signal is captured unprocessed (`echoCancellation:false`, `noiseSuppression:false`, `autoGainControl:false`); hardware gain, dynamics and mix-minus must be configured on RØDECaster itself.
- Local L/R RMS meters and overload peak warnings use Web Audio `AnalyserNode`. No signal or measurements leave the browser except when presenter explicitly starts existing WebRTC/Opus pilot.
- Input selection is saved locally; if the device disappears the user receives a warning. Input changes require ending the current presenter session; USB track ending stops the session.

## First audible mixer demonstration — offline, synthetic only
Run `cd server && node scripts/radio-offline-wav-demo.mjs ./radio-mixer-demo.wav` on a local development machine and listen to the WAV in headphones. It has two synthetic sine waves, audible music/voice overlap and ducking. It contains **no real studio microphone input**, no public MP3 stream, and is not a live server output.

## Before first real server-side broadcast
The current browser-to-browser WebRTC headphone listening path already exists, but the PCM mixer has **not been wired to the server MP3 encoder**. No dedicated isolated server stream is provided by this PR. This limitation is intentional: output authority and continuous clock must be verified first.

**Acceptance checks**: install dependencies, run server Vitest + lint and client build/lint; connect RØDECaster Duo to Mac and Windows; check stereo channels, browser permissions, speaker/monitor mix-minus, reconnect and disconnect; run offline WAV script and listen; verify no changes to radio public `/stream`, Auto-DJ or schedule. Never connect school PA, amplifier, Windows Agent, ESP32 or relay for lab testing.
