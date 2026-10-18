# Radio 2.0: real jingle insertion pilot

Real decoding of station jingles is supported only inside strict cooldown event-driven Auto-DJ. Two opt-ins are required: save `enabled=true` with approved asset IDs in the Radio > Jingles UI **and** set `RADIO_JINGLE_PLAYOUT_ENABLED=true` on the separate server radio Worker. Default environment setting is off; normal timeline Auto-DJ and scheduled playback are unchanged.

A jingle is selected after the configured number of fully decoded music tracks (only a decoder exit code 0 with >=1000 ms PCM counts). The Worker checks the current Moscow daypart, uses actual RadioAsset metadata from the database and checks that the source file exists on disk. The next scheduled transmission must be at least the configured maximum jingle duration plus 500ms away. Existing watchdog can terminate Auto-DJ when the schedule takes priority. The existing persistent MP3 encoder remains alive, with a new FFmpeg decoder per jingle. Journal entries retain `mode=AUTO_DJ`; health state `mode=JINGLE` distinguishes the temporary insert.

Limitations: not gapless; jingle counting is in Worker memory and resets on restart; it is not designed for multiple active workers or live microphone sources. An unsuccessful decoder may retry a jingle, and the source may disappear between existence check and spawn. Crossfade remains disabled for strict queue. All these should be addressed in a later robustness step, not promised in this pilot.

Safety checklist: keep flag OFF on production; test on isolated loopback Worker and listen on **headphones only**. Verify schedule preemption, config disabled, missing file, restart, order and PCM history; then separately approve any live enablement. Do not use school PA, amplifier, ESP32 or relay to test.
