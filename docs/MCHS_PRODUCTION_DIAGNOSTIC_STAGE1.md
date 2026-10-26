# MCHS production-site diagnostic isolation (TEST ONLY)

This stage is **observation infrastructure only**. No real MCHS notifications, playout, sirens, relays, amplifiers, emergency activation, or radio controls.

## Isolation
- Existing `POST /api/safety-ingest/event` remains unchanged and disabled by default.
- New `POST /api/safety-ingest/diagnostic` accepts only **exact** synthetic title/body and `testOnly: true`, `eventId: diagnostic-[a-z0-9-]{8,120}`, with no extra JSON keys.
- Separate `MCHS_DIAGNOSTIC_ENABLED` (defaults OFF) and `MCHS_DIAGNOSTIC_HMAC_KEY` (>=32 characters, separate from the ingest and Android localhost lab keys).
- HMAC SHA-256 over timestamp + '.' + raw JSON request bytes; `X-MCHS-Timestamp` seconds (±120 seconds), `X-MCHS-Signature: sha256=<hex>`.
- Isolated `SafetyMchsDiagnostic` table stores only event ID and receipt time. Unique event ID ensures idempotency.
- Read-only diagnostic list appears in authorized /app/safety and administration Safety/MCHS panel. No state transition authorizes radio operations.

## Deploy checklist (primary site)
1. Review and merge; run normal database backup, `prisma migrate deploy`, `prisma generate`, server/client build and reload through the established deployment script.
2. Verify disabled-by-default: unsigned POST to `https://mediarafraw.ru/api/safety-ingest/diagnostic` returns 503 with `DIAGNOSTIC_DISABLED`.
3. Restrict the diagnostic URL in nginx to a fixed trusted source IP/VPN and add a request rate limit. Do not expose an unprotected public diagnostic endpoint.
4. Generate a distinct, sufficiently random secret and provide `MCHS_DIAGNOSTIC_ENABLED=true` and `MCHS_DIAGNOSTIC_HMAC_KEY` to **mediaraf-api.service** through its secure environment configuration, *not* in git/history. Do not enable `MCHS_INGEST_ENABLED`.
5. Supply the same diagnostic secret to the sender process as `MCHS_DIAGNOSTIC_HMAC_KEY`; do not print or share it. From the checked-out repository on an allowlisted machine:
   ```bash
   python3 tools/mchs-sender/production_diagnostic_smoke.py --url https://mediarafraw.ru/api/safety-ingest/diagnostic --repeat
   ```
6. Expect two accepted ACKs with the same DB record id; exactly one row under diagnostic journal, no entry in actual MCHS event journal. Verify no radio behavior. Also check 401 invalid signature, stale timestamp and 400 synthetic-only enforcement.
7. Disable `MCHS_DIAGNOSTIC_ENABLED` and restart service when not testing.

No automatic Android sender is included. The production-site diagnostic route must never become an emergency alert channel. A push notification listener alone is not authoritative evidence that a state agency issued an alert.
