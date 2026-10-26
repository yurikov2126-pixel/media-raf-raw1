# Existing MCHS journal: historical Android observation (manual pilot)

This implementation does **not** create another journal. It uses existing `SafetyMchsEvent` and `/api/safety-ingest/event` exactly as designed, and updates the current admin journal to label historical and unverified observations.

## What it does
- A read-only one-shot Python importer accepts an Android SQLite **snapshot**, selected stable event ID, and only the package `io.citizens.security`.
- Default mode performs validation and displays metadata only. No HTTP is sent.
- Explicit `--send` sends precisely one historical record over TLS with the existing HMAC contract and validates the ACK. It does **not** update Android SQLite `delivered_at`; permanent delivery is a separate work stage.
- This only attests to receipt of an Android push. It does not verify government origin, regional relevance, or whether the danger is ongoing.
- Existing `/api/safety-ingest/diagnostic` and isolated diagnostic table remain unchanged.
- No radio, playout, speaker, amplifier, or siren paths are invoked.

## Dry run on the VM hosting Android

```bash
adb -s 127.0.0.1:5557 exec-out run-as ru.politech.mchsbridge.v2 cat databases/mchs_bridge_v2.db > /tmp/mchs_observation_readonly.db
python3 tools/mchs-sender/import_historical_observation.py --db /tmp/mchs_observation_readonly.db --event-id ba1e9b8b70ce9deeb11f45a6cd8f98e06cfbecf63a8f71715f20a230c64940e1
```

Run the importer from a repository checkout, or copy the script to the VM; the actual snapshot should remain on a trusted machine and be access restricted. Stop if a SQLite WAL-consistency problem occurs; do not delete the Android database. Output is metadata only.

## Enabling single-event send (separate operational decision)
1. Verify the production API and Prisma migration are already deployed and stable.
2. Require IP allowlist/VPN, nginx rate limiting, TLS, isolated `MCHS_INGEST_HMAC_KEY` different from `MCHS_DIAGNOSTIC_HMAC_KEY`; **never use the diagnostic key**.
3. Independently set `MCHS_INGEST_ENABLED=true` for the controlled test window. This enables the existing entire `/event` receiver, not just this importer, so restrict network access before doing so.
4. Give the importer the key via a secure environment. Run once with `--send`, then confirm an entry in the existing journal. The message must be labeled historical and unverified.
5. Disable `MCHS_INGEST_ENABLED` when done, then restart service.
6. Do not treat Android `delivered_at=NULL` as a failure of this manual import; only a future on-device durable sender may update it on matching ACK.

Before continuous delivery: on-device queue sender, trust and region assessment, permission review, replay/race/retry tests, rate limit, emergency shutoff, and separate operational sign-off. This project is not the statutory emergency broadcast channel.
