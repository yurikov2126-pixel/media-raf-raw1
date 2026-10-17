# Radio 2.0 — Stage 2

## Included
- Administrator-only media library with private audio storage (`RADIO_ASSET_DIR`, default `private/radio-audio`).
- 30 MiB per upload; MP3, WAV, OGG, FLAC, M4A; file-header sanity check and server-side duration extraction via **ffprobe**.
- Ordered playlists with immutable approved state; scheduled playlists cannot be edited.
- One-off broadcasting schedule with server-side no-overlap check and duration calculated from the actual assets.
- A responsive radio workspace at `/app/radio`.
- Server routes protected by `auth, requireRole('ADMIN')`.

## Deployment prerequisites
1. Ensure `ffprobe` is installed and available to the server process (`ffmpeg` tools).
2. Ensure `RADIO_ASSET_DIR` exists or is creatable and is on backed-up private storage.
3. Apply migration `20261017080000_radio_stage2` via the repository migration deployment process and generate the Prisma client.
4. Run server tests and client build before merging. Preview may require a separate migration step, per existing preview runbook.
5. Do **not** expose private radio files via generic `/uploads`.

## Safety
No Windows Radio Agent, ESP32, relay, live-stream or emergency broadcast commands are implemented. Planning a show does not cause playback. Mandatory emergency messaging must not rely on this module.

## Known limits / next stage
- Only single-occurrence slots; recurrence templates and calendar views to follow.
- Schedule times are submitted as an ISO UTC instant from the browser's local datetime input. Before automatic playout, station timezone and daylight-saving rules must be fixed in station settings.
- Client audio preview uses an authenticated blob fetch; very long files should eventually use authenticated streaming/range support.
- The generated audio metadata has not yet been independently checked in a running instance.
- There is currently no local Windows client and no amp-ready handshake.
