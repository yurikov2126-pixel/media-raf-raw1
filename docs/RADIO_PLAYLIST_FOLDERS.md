# Radio 2.0 — playlist folders and deletion

## Functional changes
- Compact playlist listing with «Плейлисты» subheading, folder sections and collapse/expand.
- Folder create/rename/delete. Deleting a folder moves its playlists to «Без папки»; it never deletes playlists.
- Move playlist by HTML drag-and-drop onto folder or via accessible select (mobile/fallback).
- Admin-only delete playlist with a transaction-scoped database advisory lock used also for creating broadcast slots. Deletion is rejected (HTTP 409) if **any** RadioScheduleSlot references the playlist, including past slots.
- Existing RADIO routes still require ADMIN. Audio assets and radio devices are not touched.

## Ubuntu 24.04 + aaPanel deployment
No new apt packages or npm dependencies. **A Prisma migration is required**: `20261017090000_radio_playlist_folders`.
Use the existing production deploy script (database backup first, then migrate and build); do not run migration concurrently with the deploy. Preview has its own deployment runbook. The migration creates `RadioPlaylistFolder` and nullable `RadioPlaylist.folderId` with a foreign key; previous playlists remain unfiled.

## Checklist
- Test admin authorization for folder create/rename/delete and playlist move/delete.
- Create folders with Cyrillic names and move playlists with drag-and-drop and the select field.
- Verify a playlist scheduled in the past or future cannot be deleted (409).
- Unscheduled playlists can be deleted, with related playlist items removed by existing cascade.
- Delete a nonempty folder: playlists remain available under «Без папки».
- Verify the existing first-page Radio dashboard design and playlist editor have not changed.
- Verify CI, Prisma migrate, and React build before merging.
