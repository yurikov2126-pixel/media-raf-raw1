# Stage 1030 — MCHS real PCM pre-roll and event-bound relay diagnostics

## Problem
The Windows Agent polls /agent/amplifier-intent every 3000 ms. Real MCHS audio begins when Worker accepts PCM; a short ALL-CLEAR can end before the next poll. This is a possible cause of the real-world AA-300 failure, not yet confirmed by historical relay telemetry.

## Opt-in implementation
- New RADIO_MCHS_POWER_PREROLL_MS sets an integer 0 to 6000, default **0**. Once authenticated Worker START prepares a real event, the common MP3 encoder continues regular program (or silence) for a PCM-clocked interval before replacing frames with the alert. The event is visible as PREEMPTING / active=true while the Agent can poll its authenticated server power permit.
- Worker GET /mchs-station-session exposes preRollActive and preRollRemainingMs and logs MCHS_STATION_POWER_PREROLL at start and end. The message powerAcknowledged:false means hardware feedback is **not available to Worker**.
- The current API /agent/amplifier-intent includes mchsEventId, mchsPreRollActive, mchsPreRollRemainingMs. The Windows Agent power diagnostics now associate INTENT_RESPONSE, POWER_COMMAND, and RELAY_TRANSITION with the actual MCHS eventId.
- A bounded lead-in is NOT a hardware acknowledgement. Existing exact registered ESP32 IP, rr_ identity, operator hardware arming, emergency/manual OFF, signed lease and watchdog remain authoritative. No new START routes, radio playback modes, Android ingestion or synthetic test flags.

## Rollout safety
Flag remains disabled on merge: a 4.5-second lead-in intentionally postpones the entire alert, even if PA never powers on. It must not be enabled until on-site operator verifies electrical and acoustic safety in an isolated safe setup and accepts the latency trade-off. This does not guarantee physical amplifier energization or alert audibility.
To configure **after** those checks, set RADIO_MCHS_POWER_PREROLL_MS=4500 in the radio Worker environment and restart it outside an actual alarm; 0 disables it. Update Windows Agent EXE to get event-scoped evidence. ESP32 firmware unchanged.
Before attempting any live acceptance, inspect worker session status, authenticated API power permit, Agent log INTENT_RESPONSE / POWER_COMMAND / RELAY_TRANSITION and actual ESP32 feedback for the same eventId. Do not produce fake public alerts.

## Limits and follow-up
To guarantee alert begins only after an ON acknowledgment, a dedicated authenticated event-bound hardware-readiness protocol and explicit fallback policy would be required. This PR deliberately does not claim or implement that guarantee.