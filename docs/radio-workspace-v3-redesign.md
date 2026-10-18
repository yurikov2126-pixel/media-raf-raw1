# RADIO Workspace 3.0 — operator-focused UX

## Design references

**Rivendell RDAirPlay** (official operations guide): on-air indicators and audio levels at top, concise log and action controls rather than mixing library administration into playback. https://opsguide.rivendellaudio.org/html/sect.rdairplay.layout.html

**Mixxx** (official user manual): task-focused, collapsible visual sections and a separate music library. https://manual.mixxx.org/2.5/en/chapters/user_interface

The design adapts these ideas to a web-based school radio system. It does not copy either product visually and deliberately does not display non-working playout buttons. No new permissions, streaming endpoints, source control or relay commands are introduced.

## New information architecture

1. **Эфирный пульт** — compact now-playing screen, track progress, server state, station clock, next event, counters and fast destinations. Includes no destructive on-air buttons.
2. **Студия** — existing RØDECaster Duo USB input, isolated Opus and PCM audition, headphone safety checklist.
3. **Сетка вещания** — existing schedule editor and event management.
4. **Плейлисты** — existing playlist/folder approval and edit workflows.
5. **Аудиотека** — existing asset browser, uploads and local listening.
6. **Автоматизация** — existing source priority policy, Auto-DJ, rotation and jingles; settings moved off the landing page.
7. **Звук** — existing processing and cue-point tools.
8. **История** — existing full playout history, replacing the placeholder.
9. **Оборудование** — Windows Radio Agent and registered devices.

## Interaction rules

- Responsive left navigation on desktop, toggleable overlay on narrow viewports.
- Alt+1 through Alt+9 opens each section when focus is not inside an input.
- URLs with `?tab=...` open matching areas, and sidebar navigation updates the URL; unknown tabs fall back to the control room.
- Keyboard focus indicators, high-contrast selected navigation item, reduced motion media preference, 2- and 4-column responsive overview cards.
- All API requests, route authorization, session safety and on-air behavior remain the same.
- Live PCM and production switching are still experimental. The UI must never imply that an unconfirmed worker is in the live on-air state.

## QA checklist

- Run `cd client && npm run build` and applicable frontend lint/test scripts.
- Verify both light and dark modes, 320/390px iPhone PWA, tablet, 1366px desktop and ultrawide monitor.
- Traverse all 9 sidebar screens; check navigation history/deep links, Alt shortcuts, overlays, scroll restoration.
- Test asset upload/preview/delete, playlist wizard, folder drag/drop, schedule editing and overlap checks, station diagnostics, history loading, Studio RØDECaster input and private test monitoring.
- Verify empty database, worker offline, failed API and slow network.
- Ensure station MP3, scheduled playout and ESP32/Windows agent remain untouched. The redesign is strictly frontend.
