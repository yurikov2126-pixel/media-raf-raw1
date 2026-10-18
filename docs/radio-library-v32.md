# RADIO 3.2 — large music library workflow

- Search/sort/pagination on the server through ADMIN-only `GET /radio/assets/browse`; pages of 25/50/100, search against filename and JSON tag title, artist, album.
- Folder navigation + OS drag/drop; selected files can move as a group through `POST /radio/assets/bulk-move`. Existing audio files and Auto-DJ asset identifiers remain unchanged.
- Multi-select on the visible page → create radio playlist using existing `POST /radio/playlists` with `assetIds`. The new playlist follows existing approval rules; it does not automatically start broadcasting.
- Per-file action button/context menu with playback, tag editing, tag rescan, move, rename, delete. Secondary buttons removed from each row.
- ID3: already extracted automatically on each new upload by `ffprobe -show_format -show_streams -of json` in PR #460; manual rescan available for old tracks and metadata edits remain DB-only, not destructive writes to original files.
- The old `GET /radio/assets` endpoint is kept for legacy playlist/scheduling usages. File manager uses its own pagination endpoint.

## Test acceptance
1. Upload MP3 with Cyrillic ID3v2 tags, confirm artist/title/album without clicking 'rescan'.
2. Load 1000+ records; paginate and search across records outside first page.
3. Select several on one page, create new playlist, check existing approval flow and item order.
4. Drag one or several selected records to another folder; refresh, verify count and file links.
5. Long-tap/right-click opens menu; play, edit ID3 and delete function; mobile still has the ⋯ action.
6. Worker/Auto-DJ/stream unaffected. Use mobile/PWA and dark/light themes.
