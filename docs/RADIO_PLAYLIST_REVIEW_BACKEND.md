# Radio Playlists 2.0 — review backend (stage 1)

This first PR is backend-only: the student playlist UI and admin review UI are **not** yet integrated. Do not advertise this as a finished workflow until both are implemented.

## API
- Existing /api/radio playlists admin routes remain protected by ADMIN. Existing admin UI must keep working.
- Admin-created playlists are immediately APPROVED on create with approvedBy/approvedAt. Older playlists and scheduled slots are preserved.
- Students (role STUDENT) may GET /api/radio/student/assets (safe metadata), GET /api/radio/student/playlists, POST /api/radio/student/playlists, PUT /api/radio/student/playlists/:id in DRAFT or RETURNED, and POST /api/radio/student/playlists/:id/submit.
- Students cannot modify other students' playlists or approved/submitted playlists via student endpoints.
- Admin POST /api/radio/playlists/:id/approve acts on SUBMITTED student-owned playlists only; POST /api/radio/playlists/:id/return requires reason between 1 and 1000 chars.
- Notification rows are created for SUBMITTED (admins), APPROVED and RETURNED (owner); UI routing and notification copy needs a follow-up change.

## Migration
Apply Prisma migration `20261018113000_radio_playlist_review` before API release.
Adds nullable reviewedReason and submittedAt fields, preserving existing rows and planned broadcasts.

## Follow-up required
- UI: student drag-and-drop editor; list of own playlists and status; submit/resubmit; admin review queue, approve/return reason dialog; notifications navigate to the playlist.
- Tests: role isolation, foreign ID writes, status transitions, empty playlist, notification delivery, admin auto-approval and schema migration.
- Check current schema generated Prisma client before deploying. Do not deploy incompatible server route and migration out of sequence.
