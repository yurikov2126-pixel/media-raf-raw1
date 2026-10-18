# Radio public LIVE — guarded production integration

## Source of truth
The Worker holds the single existing FFmpeg MP3 encoder and switches its PCM input:
- default: scheduled program > Auto-DJ > silence
- live: current authenticated admin-presenter, **only after explicit «В эфир»** and sufficient recent PCM
- scheduled program starting during live: cancels live and returns to the authoritative schedule within the next schedule check (up to 1 second)
- stop/disconnect/end of PCM session, stream starvation or FFmpeg input failure: live flag is cleared, the normal scheduler resumes

Only the ADMIN Socket.IO presenter owning a working Opus/FFmpeg gateway can ask the loopback Worker to take/leave public LIVE. Requests contain the Worker session token, validated against the active session. No browser ever receives Worker tokens or server secret.

## Deployment configuration on production
**Do not enable by merely deploying the PR.** There is a new separate public cutover flag on BOTH production services:
- API: `RADIO_PUBLIC_LIVE_ENABLED=true`
- Worker: `RADIO_PUBLIC_LIVE_ENABLED=true` plus `RADIO_LIVE_PCM_INTAKE_ENABLED=true`.
Existing `RADIO_BROWSER_OPUS_UPLINK_ENABLED=true` and `RADIO_BROWSER_PCM_GATEWAY_ENABLED=true` and shared secret are also required.

Deploy using the repo's backup/migrate procedure. During a low-risk maintenance window, turn on flags for both processes, restart the Worker and API, test monitoring before public take, and explicitly disconnect school PA for first live cutover. Worker restart interrupts stream; inform listeners. The public MP3 URL is unchanged. Monitor Worker logs, `/live-pcm/status` via trusted authenticated loopback, station public stream, and Studio health statuses.

## Actual broadcast steps
1. Select RØDECaster Duo USB input with mix-minus and verify L/R.
2. Join studio as presenter and click «Тест передачи Opus» to establish decoder and verify fresh PCM.
3. Wait at least 0.5 s; click **«● В эфир»**. Wait for Worker acknowledgement before announcing.
4. Listen on a separate client/device in headphones via PUBLIC MP3, not private PCM monitor; compare against Auto-DJ.
5. Click **«Завершить эфир / Auto-DJ»**. Verify public MP3 returns to schedule/Auto-DJ.
6. Test USB disconnect and network loss; no stale microphone PCM must remain on air. A scheduled show takes priority.

## Important limitations and release gate
This is the first real PCM selector, NOT yet a broadcast-certified mixing board. In this PR the handover cuts between sources: **there is no smooth music/voice crossfade and no simultaneous Auto-DJ ducking**. The PCM gateway still uses 250ms browser MediaRecorder segments and a best-effort Worker buffer. Due to buffering and HTTP/Socket.IO latency, listeners may experience delays or gaps. The Worker tries to recover, but there is no measured zero-silence SLA. Do not leave unattended on-air before a monitored production dress rehearsal.

Production cutover requires: successful CI + simulated gate tests, real MP3 playback test with a second device, scheduled-show preemption, 30-min run, browser crash and network failover, and an operator rollback plan. To instantly disable public LIVE, set `RADIO_PUBLIC_LIVE_ENABLED=false` on API and Worker and restart processes (note restarting Worker also restarts public encoder). The quickest less-disruptive live rollback while reachable is «Завершить эфир / Auto-DJ».
