# MCHS: isolated Windows Agent output pilot (not for evacuation use)

This is a standalone, manual, single-run sound-output experiment. It **does not**
modify normal Radio Agent playback, playlists, Windows GUI, system services,
ESP32 or the AA-300 amplifier.

## Physical preflight (mandatory)

1. Stop the ordinary Windows Radio Agent. **Physically unplug the audio cable
   from the amplifier / corridor PA**; simply muting or switching relay OFF is
   not an acceptable substitute.
2. Connect isolated headphones to the Windows computer. In Windows Sound
   Settings select those headphones as the **default output**. VLC uses the
   Windows default output; the script **cannot verify the physical wiring**.
3. Use a disposable, registered Radio Device token with playbackAllowed; do
   not use the production corridor Agent's token.
4. Load short, clearly labelled *training* music and voice WAV files into the
   isolated Worker laboratory, then use its control panel to switch START,
   INTERRUPT, RESUME and STOP. No genuine emergency tones/messages.

## Server configuration (disabled by default)

In the API environment (NOT in the public site frontend):

```text
MCHS_AGENT_LAB_STREAM_ENABLED=true
MCHS_AGENT_LAB_DEVICE_ID=<dedicated test RadioDevice ID>
```

Restart API during a normal maintenance window. This grants read-only access
to exactly one device ID at `/api/radio-agent/agent/mchs-lab-pcm` via the
registered device token. Worker remains on 127.0.0.1. Never use the
production corridor Agent device ID. Disable the flag after the test.

## Manual Windows run

Set `RADIO_AGENT_TOKEN` locally in the process environment (never print it),
then run from `radio-agent/windows`:

```powershell
py -3 mchs_isolated_output_pilot.py --vlc "C:\Program Files\VideoLAN\VLC\vlc.exe" --physical-disconnect-confirmation PA_DISCONNECTED
```

The script creates a loopback-only authenticated PCM-to-WAV relay and invokes
VLC for a maximum of 65 seconds. It does not autorun, store or log credentials,
connect to PA, alter amplifier power or send any emergency control command.
Press Ctrl+C to end the test. It only plays to the **Windows default output**.
The explicit confirmation is a human acknowledgement, not a hardware interlock.

## Acceptance criteria

- Audio heard only in isolated headphones, not in PA; no amplifier power changes.
- START → music; INTERRUPT → training voice; RESUME → music; STOP → silence.
- Endpoint returns 403 when lab feature off or device ID mismatched.
- Network disconnect ends the pilot or silences VLC; no fallback to station audio.
- After tests stop client, set MCHS_AGENT_LAB_STREAM_ENABLED=false and restart API.

**Safety boundary**: this is not a statutory evacuation or life-safety
announcement system. Qualified safety and audio personnel must validate
hardware-priority interruption independently before any building speakers test.
