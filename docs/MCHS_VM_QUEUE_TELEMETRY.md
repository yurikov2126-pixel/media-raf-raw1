# Android VM queue telemetry

Sender: `tools/mchs-sender/vm_observer.py`. On each regular signed heartbeat after `drain`, sender now includes:

- `queuedLocal`: rows with `ack_at IS NULL` (includes retry backoff).
- `failedSends`: cumulative failed attempts for **pending** rows (not lifetime failures; falls when a failed row is ACKed).
- `lastSentAt`: latest durable ACK timestamp across all rows; omitted when none.

All values are observations about the local VM queue, not proof of complete Android push delivery. There is no synthetic event creation or radio control. Existing retry/ACK behavior is unchanged.

## Rollout on mchs-android

First merge reviewed PR #733 (or the actual PR number), and ensure server PR #732 has deployed with Prisma migration.

```bash
python3 -m unittest discover -s tools/mchs-sender -p 'test_vm_observer.py'
```

On VM, back up existing script before replacing it. Download from **reviewed main**, syntax-check, run `--dry-run --once` (no network sends) and then stop/restart the existing `mchs-observer.service` during maintenance. Do not overwrite local `ingest.env`, delete the SQLite queue, or change ADB, certificates, retry policy or Radio Worker. Confirm server `/api/safety/delivery-diagnostics` reports a fresh `vmTelemetry` object after restart. The first heartbeat may be delayed until the VM finishes its read and send cycle.
