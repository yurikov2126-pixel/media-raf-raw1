#!/usr/bin/env python3
"""Synthetic-only smoke check for the isolated production diagnostic route."""
import argparse
import hashlib
import hmac
import json
import os
import secrets
import sys
import time
import urllib.error
import urllib.request


def send(url, secret, body):
    stamp = str(int(time.time()))
    signature = hmac.new(secret.encode(), stamp.encode() + b"." + body, hashlib.sha256).hexdigest()
    request = urllib.request.Request(url, body, method="POST", headers={
        "Content-Type": "application/json",
        "X-MCHS-Timestamp": stamp,
        "X-MCHS-Signature": "sha256=" + signature,
    })
    with urllib.request.urlopen(request, timeout=12) as response:
        if response.status != 200:
            raise ValueError("Unexpected HTTP status")
        return json.load(response)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--repeat", action="store_true")
    args = ap.parse_args()
    if args.url != "https://mediarafraw.ru/api/safety-ingest/diagnostic":
        ap.error("Only the isolated diagnostic endpoint on mediarafraw.ru is allowed")
    key = os.getenv("MCHS_DIAGNOSTIC_HMAC_KEY", "")
    if len(key) < 32:
        ap.error("MCHS_DIAGNOSTIC_HMAC_KEY (>=32 chars) is required")
    event_id = "diagnostic-" + secrets.token_hex(16)
    body = json.dumps({
        "eventId": event_id,
        "title": "ТЕСТ: диагностика приёмника",
        "body": "Искусственная проверка записи журнала. Не является предупреждением или оповещением.",
        "testOnly": True,
    }, ensure_ascii=False, separators=(",", ":")).encode()
    try:
        first = send(args.url, key, body)
        if first.get("accepted") is not True or first.get("eventId") != event_id or first.get("testOnly") is not True or first.get("verified") is not False or not first.get("id"):
            raise ValueError("Invalid ACK")
        print("ACK accepted; synthetic record:", first["id"])
        if args.repeat:
            second = send(args.url, key, body)
            if second.get("id") != first["id"]:
                raise ValueError("Idempotency FAILED")
            print("Duplicate request returned the same record id")
        print("PASS: isolated synthetic diagnostic")
        return 0
    except (urllib.error.HTTPError, urllib.error.URLError, ValueError) as exc:
        print("FAIL:", str(exc)[:160], file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
