# Windows Radio Agent — stream unaffected by main API deploys

The Windows agent already calls GET /api/radio-agent/agent/stream with its Bearer device token.
This change extends the independent loopback gateway on port 4106 to serve that exact path.

The gateway validates the token and playback permission by calling the existing
/api/radio-agent/agent/status endpoint on localhost:4000 **once before opening the MP3
stream**. Existing deviceAuth, revokedAt and playbackAllowed rules remain authoritative.
After successful authorization, the continuous MP3 stream is forwarded independently
from Worker 4105. Existing streams continue during main API restarts.
**New** Agent connections during an API restart may get 503 until authorization
becomes available again. A revoked token or disabled playback affects the next
connection; as with the previous Express stream route it does not revoke an
already-open connection immediately.

## Staged rollout

1. Merge PR and wait for successful production deploy. Existing nginx keeps
   the agent on port 4000 until manually switched.
2. Restart only the gateway service to load updated code:
   `systemctl restart mediaraf-radio-public-stream.service`.
   This WILL briefly interrupt public streaming listeners; choose a maintenance
   window. The gateway uses a single process, so upgrading it without a
   listener interruption requires a separate zero-downtime strategy.
3. Verify `curl -fsS http://127.0.0.1:4106/health`.
   A no-token request to
   `http://127.0.0.1:4106/api/radio-agent/agent/stream` MUST yield 401.
   Do not paste a device token into a shell command or share it in logs.
4. Back up the active nginx site config; add
   `ops/nginx/radio-agent-stream.location.conf` inside its server block
   next to the existing public exact-match location. Do not modify the generic
   /api/ location. Verify no duplicate exact match exists in includes.
5. `/www/server/nginx/sbin/nginx -t`; reload nginx only when valid.
6. Verify the Windows agent reconnects and streams audio. A maintenance-window
   API restart should leave **existing** agent playback uninterrupted.
7. Roll back by removing the new nginx exact match, testing and reloading nginx.
   The old Express path will serve the agent again.

NOTE: The current gateway has no seamless process upgrades. Keep deployments
from restarting the gateway. Main API deploys must not restart Worker or gateway.
