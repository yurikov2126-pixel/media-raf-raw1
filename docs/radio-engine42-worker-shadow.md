# Radio 2.0 Audio Engine 4.2 — Worker timed PCM shadow pilot

The isolated, authenticated Worker now optionally copies accepted 20 ms PCM frames into the `RadioTimedPcmPlayout` simulation and ticks its clock every 20 ms.

### Flags and isolation

- `RADIO_LIVE_PCM_INTAKE_ENABLED=true` is required on an isolated test Worker.
- `RADIO_TIMED_PCM_SHADOW_ENABLED=true` adds timed analysis. It is OFF by default and cannot activate independently of live intake.
- `GET /live-pcm/status` (Worker secret required, loopback only) exposes `timedShadow`, including buffer occupancy, count of simulated emissions, freshness, failure reason and `connectedToEncoder:false`.
- The simulated PCM output is **always discarded**. No source handover, MP3 encoder connection, audio playback or school PA hardware control is implemented.

### Safety behavior

- New session and valid end-of-session reset the shadow buffer.
- Strict sequential frames, bounded buffer, prebuffer and overrun detection follow Audio Engine 4.1.
- Underrun, stale input, missed timer deadline or out-of-sequence frame marks the shadow `FAILED`; it cannot resume without session reset.
- Shadow failures are reported in diagnostics without altering Auto-DJ or the original server PCM intake.
- The timer is unreferenced and only checks active ingest sessions. It deliberately does not output to station audio.

### Test

Run `cd server && npm test -- radioTimedPcmShadow`, the existing timed buffer suites, complete tests and lint. On an isolated test system, start a valid intake session, feed PCM, observe shadow metrics and then stop the session. Verify `/stream` is unchanged, and test invalid frames and timeouts without attaching school amplifiers, PA, ESP32 or relay.

This is a **shadow simulation with live input**, not yet an authoritative production playout buffer. The real source arbitration and public stream still require independent safeguards and tests.
