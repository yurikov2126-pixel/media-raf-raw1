#!/usr/bin/env python3
"""Read-only, explicit historical MCHS Android SQLite snapshot -> existing safety event journal.

No scheduler, no listener modifications, no automated playout, no SQLite writes.
Default: dry-run metadata only. Sends only with --send and an enabled ingest endpoint.
"""
import argparse
import ipaddress
import subprocess
import hashlib
import hmac
import json
import os
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

URL = "https://mediarafraw.ru/api/safety-ingest/event"
PACKAGE = "io.citizens.security"


def read_events(db_path, event_id):
    db = sqlite3.connect("file:" + Path(db_path).resolve().as_posix() + "?mode=ro", uri=True)
    try:
        rows = db.execute("""SELECT event_id, source_key, posted_at, title, body, channel_id
                             FROM events WHERE event_id = ? LIMIT 1""", (event_id,)).fetchall()
    finally:
        db.close()
    if len(rows) != 1:
        raise ValueError("Expected exactly one matching Android event")
    eid, source, posted, title, body, channel = rows[0]
    if not isinstance(source, str) or not source.split("|")[1:2] == [PACKAGE]:
        raise ValueError("Event is not from the expected Android package")
    if not isinstance(posted, int) or posted < 1_500_000_000_000 or posted > int(time.time() * 1000) + 120000:
        raise ValueError("Invalid event timestamp")
    if not isinstance(title, str) or not 1 <= len(title) <= 300 or not isinstance(body, str) or len(body) > 4000:
        raise ValueError("Event title/body invalid for server contract")
    if not isinstance(channel, str) or len(channel) > 100:
        raise ValueError("Invalid channel")
    if not isinstance(eid, str) or not all(c in "0123456789abcdef" for c in eid.lower()) or len(eid) != 64:
        raise ValueError("Expected stable 64-character SHA-256 event ID")
    return {
        "eventId": eid,
        "title": title,
        "body": body,
        "channelId": channel,
        "occurredAt": datetime.fromtimestamp(posted / 1000, timezone.utc).isoformat().replace("+00:00", "Z"),
        "region": "Тульская область",  # Manually scoped lab device, not an independently verified region.
    }


def send(body, key, connect_ip=None):
    stamp = str(int(time.time()))
    sig = hmac.new(key.encode(), stamp.encode() + b"." + body, hashlib.sha256).hexdigest()
    request = Request(URL, data=body, method="POST", headers={
        "Content-Type": "application/json",
        "X-MCHS-Timestamp": stamp,
        "X-MCHS-Signature": "sha256=" + sig,
    })
    if connect_ip:
        ip = ipaddress.ip_address(connect_ip)
        if not ip.is_private:
            raise ValueError("--connect-ip must be a private address")
        # curl --resolve changes TCP destination while preserving hostname/SNI and normal CA verification.
        # Proxy environment settings must not silently reroute the private connection.
        cmd = ["curl", "--fail-with-body", "--silent", "--show-error",
               "--proto", "=https", "--noproxy", "*", "--max-time", "15",
               "--resolve", f"mediarafraw.ru:443:{connect_ip}",
               "-X", "POST", "-H", "Content-Type: application/json",
               "-H", "X-MCHS-Timestamp: " + stamp,
               "-H", "X-MCHS-Signature: sha256=" + sig,
               "--data-binary", "@-", URL]
        completed = subprocess.run(cmd, input=body, capture_output=True, timeout=20, check=False)
        if completed.returncode:
            raise ValueError("curl HTTPS failure: " + completed.stderr.decode(errors="replace")[:140])
        result = json.loads(completed.stdout)
    else:
        with urlopen(request, timeout=15) as response:
            if response.status != 200:
                raise ValueError("Non-200 ingest ACK")
            result = json.load(response)
    if (result.get("accepted") is not True or result.get("testOnly") is not True or result.get("verified") is not False):
        raise ValueError("Unaccepted response or non-observation ACK")
    return result


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--db", required=True, help="SQLite snapshot copied from Android, never its live DB")
    p.add_argument("--event-id", required=True)
    p.add_argument("--send", action="store_true", help="Explicitly send ONE historical unverified observation")
    p.add_argument("--connect-ip", help="Private IPv4/IPv6 TCP destination; HTTPS hostname and CA validation remain unchanged")
    a = p.parse_args()
    if not Path(a.db).is_file():
        p.error("Snapshot does not exist")
    try:
        payload = read_events(a.db, a.event_id)
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
        if not a.send:
            print("DRY RUN only. Source package verified; event ID:", payload["eventId"])
            print("Occurred:", payload["occurredAt"], "channel:", payload["channelId"])
            print("No request sent. Use --send after authorized endpoint rollout and IP restrictions.")
            return 0
        key = os.environ.get("MCHS_INGEST_HMAC_KEY", "")
        if len(key) < 32:
            raise ValueError("MCHS_INGEST_HMAC_KEY >=32 required; must differ from diagnostic key")
        ack = send(body, key, a.connect_ip)
        if ack.get("eventId") != payload["eventId"] or not ack.get("id"):
            raise ValueError("ACK eventId mismatch")
        print("ACK saved in server journal, ID:", ack["id"])
        print("Historical observation only; Android SQLite delivered_at was NOT changed")
        return 0
    except (sqlite3.Error, ValueError, HTTPError, URLError) as exc:
        print("ERROR:", type(exc).__name__, str(exc)[:180], file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
