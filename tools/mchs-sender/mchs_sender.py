#!/usr/bin/env python3
"""MCHS logcat collector + durable test-only delivery queue.

No radio commands, no Android permissions changes. Disabled network delivery by default.
Not an authoritative/complete emergency notification source: logcat can lose records.
"""
import hashlib
import hmac
import json
import os
import signal
import sqlite3
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ADB = os.getenv("MCHS_ADB", "/usr/bin/adb")
SERIAL = os.getenv("MCHS_SERIAL", "127.0.0.1:5557")
DB_PATH = Path(os.getenv("MCHS_QUEUE_DB", "/var/lib/mchs-sender/queue.sqlite3"))
API = os.getenv("MCHS_INGEST_URL", "")
KEY = os.getenv("MCHS_INGEST_HMAC_KEY", "")
SEND = os.getenv("MCHS_SEND_ENABLED", "false") == "true"
STOP = threading.Event()

def log(message):
    print(datetime.now(timezone.utc).isoformat(), message, flush=True)

def initialize():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(str(DB_PATH), timeout=15, isolation_level=None)
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA synchronous=FULL")
    connection.execute("""CREATE TABLE IF NOT EXISTS pending (
      event_id TEXT PRIMARY KEY, payload TEXT NOT NULL, first_seen INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0,
      delivered_at INTEGER, last_error TEXT)""")
    return connection

def parse(line):
    # logcat -v raw with a single tag filter emits the Bridge payload only.
    raw = line.strip()
    if not raw.startswith("{"):
        return None
    try:
        value = json.loads(raw)
    except (ValueError, TypeError):
        return None
    if not isinstance(value, dict) or value.get("event") != "posted" or value.get("package") != "io.citizens.security":
        return None
    key = value.get("key")
    occurred = value.get("postTime")
    if not isinstance(key, str) or not key or len(key) > 2000:
        return None
    if type(occurred) is not int or occurred < 0:
        return None
    title = value.get("title")
    body = value.get("bigText") or value.get("text") or ""
    if not isinstance(title, str) or not isinstance(body, str):
        return None
    title = title.strip()[:300]
    body = body[:4000]
    if not title:
        title = "Уведомление МЧС без заголовка"
    channel = value.get("channel")
    channel = channel if isinstance(channel, str) else None
    try:
        occurred_iso = datetime.fromtimestamp(occurred / 1000, timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    except (ValueError, OverflowError, OSError):
        return None
    event_id = hashlib.sha256((key + "|" + str(occurred) + "|" + title + "|" + body).encode("utf8")).hexdigest()
    return {
        "eventId": event_id,
        "title": title,
        "body": body,
        "channelId": channel[:100] if channel else None,
        "occurredAt": occurred_iso,
    }

def collect(connection):
    while not STOP.is_set():
        try:
            # New log stream; no replay guarantee across disconnects.
            with subprocess.Popen([ADB, "-s", SERIAL, "logcat", "-v", "raw", "-s",
                                   "MCHS_BRIDGE:I", "*:S"], stdout=subprocess.PIPE,
                                  stderr=subprocess.DEVNULL, text=True, bufsize=1) as process:
                for line in process.stdout:
                    if STOP.is_set():
                        process.terminate()
                        break
                    item = parse(line)
                    if not item:
                        continue
                    connection.execute(
                        "INSERT OR IGNORE INTO pending(event_id,payload,first_seen) VALUES(?,?,?)",
                        (item["eventId"], json.dumps(item, ensure_ascii=False), int(time.time())))
                    log("captured notification id=" + item["eventId"][:12] + " (content redacted)")
                if process.poll() is None:
                    process.terminate()
                    try: process.wait(timeout=3)
                    except subprocess.TimeoutExpired: process.kill()
        except (OSError, sqlite3.Error) as error:
            log("collector error: " + str(error))
        STOP.wait(5)

def transmit(item):
    body = item.encode("utf8")
    ts = str(int(time.time()))
    signed = ts.encode() + b"." + body
    signature = hmac.new(KEY.encode("utf8"), signed, hashlib.sha256).hexdigest()
    req = urllib.request.Request(API, data=body, method="POST", headers={
        "Content-Type": "application/json",
        "X-MCHS-Timestamp": ts,
        "X-MCHS-Signature": "sha256=" + signature,
    })
    with urllib.request.urlopen(req, timeout=10) as response:
        result = json.load(response)
        expected_id = json.loads(item)["eventId"]
        if response.status != 200 or result.get("accepted") is not True or result.get("eventId") != expected_id or result.get("testOnly") is not True:
            raise ValueError("No positive server acknowledgement")

def sender(db_path):
    connection = sqlite3.connect(str(db_path), timeout=15, isolation_level=None)
    connection.execute("PRAGMA journal_mode=WAL")
    while not STOP.is_set():
        if not SEND:
            STOP.wait(10)
            continue
        now = int(time.time())
        row = connection.execute(
            "SELECT event_id,payload,attempts FROM pending WHERE delivered_at IS NULL "
            "AND next_attempt<=? ORDER BY first_seen LIMIT 1", (now,)).fetchone()
        if not row:
            STOP.wait(5)
            continue
        event_id, payload, attempts = row
        try:
            transmit(payload)
            connection.execute("UPDATE pending SET delivered_at=?,last_error=NULL WHERE event_id=?",
                               (int(time.time()), event_id))
            log("delivered id=" + event_id[:12])
        except (urllib.error.URLError, ValueError, TimeoutError, OSError, KeyError) as error:
            backoff = min(300, 2 ** min(attempts + 1, 8))
            connection.execute(
                "UPDATE pending SET attempts=attempts+1,next_attempt=?,last_error=? WHERE event_id=?",
                (int(time.time()) + backoff, type(error).__name__, event_id))
            log("delivery delayed id=" + event_id[:12] + " error=" + type(error).__name__)
            STOP.wait(2)
    connection.close()

def main():
    if SEND and (not API.startswith("https://") or len(KEY) < 32):
        sys.exit("MCHS_SEND_ENABLED=true requires HTTPS endpoint and HMAC key >=32 characters")
    def stop(*_):
        STOP.set()
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    connection = initialize()
    worker = threading.Thread(target=sender, args=(DB_PATH,), daemon=True)
    worker.start()
    log("sender started; network delivery " + ("ON (test-only)" if SEND else "OFF"))
    collect(connection)
    connection.close()

if __name__ == "__main__":
    main()
