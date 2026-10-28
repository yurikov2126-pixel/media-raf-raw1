# MCHS alarm audio handover: safety review gate

This milestone adds a **pure assessment function**, not an audio transition engine. Never connect it to ingestion or send play commands from its result. No actual official verification exists yet.

## Existing production
- Radio Worker owns AutoDJ, scheduled programming, manual playlists, and live studio authority; do not alter its source, seek positions, hourly announcements or crossfades from the observer.
- Android notifications are observations; HMAC authenticates the VM sender, **not** the governmental alert itself.
- Speaker shutdown through ESP32 does not isolate the public /radio/listen stream or other output paths.

## Conditions before any production playout integration
1. independently authenticate an official current alert, scoped to the intended site/region;
2. support expiry, replay protection, alert-to-all-clear correlation, and audit;
3. prove physical speaker and public stream are separately isolated for testing;
4. preserve source authority, reject interruptions of LIVE, and re-query source authority at resume (never blindly resume a stale track);
5. verify failure recovery and no surprise energizing of ESP32 relay;
6. allow an authorized site operator to immediately inhibit output independent of the software receiver.

## Plan API
`planMchsAudioTransition()` returns `permitted:false`, `executable:false`, and `output:NONE` unconditionally. Reported missing gates are diagnostic only, not instructions to actuate. Do not change this invariant absent a separately reviewed safety and operational design.
