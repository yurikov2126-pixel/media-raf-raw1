# MEDIA · РАФ · RAW — Радио 2.0

## Confirmed setup
- Server: existing Express / Prisma / PostgreSQL / Socket.IO platform.
- Dedicated Windows 10 laptop: audio playout only, Ethernet primary and Wi-Fi fallback.
- Existing ESP32: amplifier power relay and autonomous clock-based schedule.
- Amplifier reported as AA-300; manufacturer, wiring, contacts and safety certification are not yet verified.
- Existing prerecorded urgent announcements use laptop audio.

## Safety boundary
Radio 2.0 is **not** the statutory life-safety / evacuation PA system. Existing emergency sound and priority must remain independently functional and be evaluated by the responsible qualified technician. Neither the server, laptop nor ESP32 can guarantee urgent evacuation announcements.

## Proposed services
1. Server Radio API: assets, immutable playlist versions, approvals, weekly schedule, device identity, audit records.
2. Windows Radio Agent: background synchronization, checksum-verified local cache, heartbeat, durable playback schedule.
3. Windows Player: WASAPI audio endpoint, works in interactive Windows session, startup after login, playback verification. Because the laptop is dedicated to radio, disable unnecessary system sound and sleep during programmed hours.
4. ESP32 firmware: signed or authenticated schedule snapshots, local clock, relay states, warm-up, cooldown, watchdog.
5. Optional later: WebRTC live contribution -> Liquidsoap/Icecast -> Windows Player.

## Planned schema
RadioAsset, RadioPlaylist, RadioPlaylistItem, RadioPlaylistVersion,
RadioScheduleSlot, RadioScheduleRevision, RadioDevice, RadioAmplifierProfile,
RadioPlayoutEvent, RadioSourceSession, RadioPermission, RadioAuditLog.

## Schedule algorithm
All server timestamps are stored as UTC instants; UI uses the explicitly configured college timezone. For a slot [start,end), amplifier switches on at start - warmup and off at end + cooldown. If two computed power windows are closer than keepAlive, merge them. Reject overlapping audio slots. Always separate commanded relay state from verified amplifier/audio state.

Initial implementation: `server/src/lib/radioSchedule.js` with Vitest unit tests. No production device control or DB migration is enabled in this phase.

## Delivery order
1. Pure schedule compiler and tests (initial PR).
2. Prisma models, migrations, permission-scoped Radio API and approval workflow.
3. React radio dashboard, playlist builder and week calendar.
4. Windows Agent + sound output pilot in lab.
5. ESP32 protocol and controlled electrical integration following on-site review.
6. Mobile live broadcasting and routine announcements.

## Required go-live tests
Offline radio playback from verified cache, reboot recovery, no relay chatter, device clock correction, deduplicated commands, dedicated audio output, login/logoff behavior, and independent statutory PA priority.
