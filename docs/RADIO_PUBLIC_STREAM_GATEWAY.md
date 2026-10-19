# Independent public radio MP3 stream

The production GitHub Actions deploy restarts `mediaraf-api.service` (port 4000).
Previously this disconnected both the public `/api/radio-agent/listen` MP3 endpoint
and the authenticated Agent stream. The public MP3 endpoint now has an
optional independent gateway on loopback port 4106. Main API remains responsible
for station metadata, scheduling and authenticated agent requests.

## Installation (manual, staged)

Do NOT edit nginx until gateway checks pass. Merge PR and deploy first.

1. Install `ops/systemd/mediaraf-radio-public-stream.service` as
   `/etc/systemd/system/mediaraf-radio-public-stream.service`.
2. Run `systemctl daemon-reload` and
   `systemctl enable --now mediaraf-radio-public-stream.service`.
3. Check `systemctl is-active mediaraf-radio-public-stream.service`
   and `curl -fsS http://127.0.0.1:4106/health`.
4. Check the stream:
   `curl --max-time 8 -o /dev/null -w 'HTTP %{http_code}, bytes %{size_download}\n' http://127.0.0.1:4106/api/radio-agent/listen`.
   Expect 200 with bytes. A timeout after eight seconds is expected for live audio.
5. Back up `/www/server/panel/vhost/nginx/mediarafraw.ru.conf` and add the
   `location = /api/radio-agent/listen` block from
   `ops/nginx/radio-public-stream.location.conf` **inside the existing server block**.
   Preserve the existing `location ~ /api/` block. Check existing includes for
   another exact-match location before editing.
6. Validate nginx configuration (`nginx -t`, using the installed binary), and
   reload nginx rather than restart it.
7. Test `https://mediarafraw.ru/api/radio-agent/listen` (200 with MP3 bytes)
   in browser and with curl. At a planned maintenance time, restart only
   `mediaraf-api.service` while listening and verify the public stream stays audible.

## Rollback

Remove only the new exact-match nginx location, validate, reload nginx.
The existing /api/ catchall resumes delivering the public stream via port 4000.
Then stop/disable the gateway if desired.

## Security and limitations

The gateway binds only to 127.0.0.1 and sends the shared Worker secret
only over loopback. Nginx never receives that secret. Never expose port 4105
or 4106 to the public internet.

This isolates only public MP3. Authenticated `/agent/stream` still uses the main
API and will disconnect during production deploys. Metadata polling on
`/listen/now-playing` also continues through the API. Worker restarts still
interrupt all streams. The deploy script itself remains unchanged and does not
restart the new gateway.

Prisma P2024 connection pool waits are a separate issue to investigate.
