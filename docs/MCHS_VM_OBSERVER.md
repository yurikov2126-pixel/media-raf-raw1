# VM observation queue (pilot, no radio)

This is a Linux **VM-side** observation service, not an APK patch. The existing Android NotificationListener keeps capturing native notifications into its existing SQLite database.

- Poll Android via ADB run-as; inspect a read-only SQLite snapshot.
- Copy valid `io.citizens.security` events to a separate durable VM SQLite queue.
- POST to existing `/api/safety-ingest/event` over HTTPS with pinned **destination IP** (but standard CA+hostname verification). Mark **VM queue** ACK only on matching server success.
- Retry failures with exponential backoff; sending same eventId is idempotent at server. Existing Android `delivered_at` remains untouched and must **not** be reported as Android ACK.
- POST /heartbeat once per successful poll, reporting live notification listener status; `push=UNKNOWN` until real FCM registration is independently measurable. Heartbeat is liveness, not proof of delivery.
- Never accesses radio/speaker APIs, verifies no official government origin, and doesn't infer a current threat from received notifications.

## Review and dry-run

On `mchs-android`, download the file from **reviewed main** after PR merge (or inspect the draft branch before):
```bash
curl -fSL https://raw.githubusercontent.com/yurikov2126-pixel/media-raf-raw1/main/tools/mchs-sender/vm_observer.py -o ~/vm_observer.py
python3 -m py_compile ~/vm_observer.py
python3 ~/vm_observer.py --dry-run --once
```

The VM's local durable queue is stored in `~/.local/state/mchs-observer/queue.db`. File contains notification text, so ensure it is private and backed up securely. Queue stores original events and never removes them automatically; define retention policy prior to broad operation. First run may queue all old eligible events (currently expected one), not just new.

## Before enabling background sending

1. Verify `MCHS_INGEST_ENABLED=true` in the production API and HMAC secret shared securely to VM, but **never expose it in source/log/chat**.
2. Extend exact Nginx ingress allowlist to **both** `/api/safety-ingest/event` and `/api/safety-ingest/heartbeat` (and apply rate limits). No IP allowlist alone proves caller identity.
3. Verify `curl --resolve mediarafraw.ru:443:192.168.10.33` over HTTPS with usual certificate verification. The VM sender doesn't disable TLS checks.
4. Review unit file; prepare state directory with `install -d -m 700 /home/mchs-android/.local/state/mchs-observer` as `mchs-android`, and install unit at `/etc/systemd/system/mchs-observer.service`. Do not inadvertently restart/replace the existing Android listener.
5. Only after dry-run/single real ACK/heartbeat can you start `systemctl enable --now mchs-observer.service`. Verify journal for `SNAPSHOT`, `ACK`, `HEARTBEAT_ACK`, and server journal.
6. To pause: `sudo systemctl disable --now mchs-observer.service`. To stop incoming events server-side: `MCHS_INGEST_ENABLED=false` and restart `mediaraf-api.service`.

## Known limitations (important)

This stage cannot set Android SQLite `delivered_at` and is not an on-device WorkManager sender. ADB needs to remain online; DB+WAL read can race with Android writes. Snapshot integrity check fails safely and retries next poll. Bad/missing listeners will be reported disconnected where dumpsys is available. No notification is a legitimate proof of current regional safety, and a heartbeat is not a proof notifications are delivered. Review and test on VM before claiming 24/7 reliability.
