#!/usr/bin/env python3
"""One-shot, synthetic-only MCHS preview ingest probe. Never reads Android events."""
import argparse
import hashlib
import hmac
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


def post(url, key, payload, event_id):
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    stamp = str(int(datetime.now(timezone.utc).timestamp()))
    signature = hmac.new(key.encode("utf-8"), stamp.encode("ascii") + b"." + body, hashlib.sha256).hexdigest()
    req = Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "X-MCHS-Timestamp": stamp,
            "X-MCHS-Signature": "sha256=" + signature,
        },
        method="POST",
    )
    with urlopen(req, timeout=10) as response:
        result = json.load(response)
        if response.status != 200 or result.get("eventId") != event_id or result.get("accepted") is not True or result.get("testOnly") is not True or result.get("verified") is not False:
            raise RuntimeError("Invalid test-only acknowledgement")
        return result


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--url", required=True, help="Explicit HTTPS preview endpoint /api/safety-ingest/event")
    p.add_argument("--repeat", action="store_true", help="Send exactly the same artificial event twice; verify same DB record id")
    args = p.parse_args()
    u = urlparse(args.url)
    if u.scheme != "https" or not u.hostname or u.path != "/api/safety-ingest/event" or u.query or u.fragment:
        p.error("Only an explicit HTTPS /api/safety-ingest/event endpoint is allowed")
    if u.hostname == "mediarafraw.ru" or u.hostname == "www.mediarafraw.ru" or not u.hostname.startswith("preview."):
        p.error("Refusing non-preview hostname")
    key = os.getenv("MCHS_PREVIEW_INGEST_HMAC_KEY", "")
    if len(key) < 32:
        p.error("Set a distinct MCHS_PREVIEW_INGEST_HMAC_KEY (>=32 chars) in the local environment")
    event_id = "observation-smoke-" + uuid.uuid4().hex
    payload = {
        "eventId": event_id,
        "title": "ТЕСТ: диагностика приёмника",
        "body": "Искусственная проверка записи журнала. Не является предупреждением или оповещением.",
        "channelId": "synthetic-test",
        "region": "TEST ONLY",
        "occurredAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    try:
        first = post(args.url, key, payload, event_id)
        print("ACK 1: accepted/testOnly, verified=false, record id:", first.get("id"))
        if args.repeat:
            second = post(args.url, key, payload, event_id)
            if second.get("id") != first.get("id"):
                raise RuntimeError("Duplicate event produced a different record")
            print("ACK 2: idempotency confirmed (same record id)")
    except (HTTPError, URLError, RuntimeError, ValueError) as e:
        print("Probe failed:", type(e).__name__, str(e)[:180], file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
