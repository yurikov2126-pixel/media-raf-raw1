#!/usr/bin/env python3
"""VM-side observation-only queue and heartbeat for MCHS Bridge V2.

Reads app SQLite via ADB run-as, retains durable *host-side* ACK state, sends to
the existing /event and /heartbeat endpoints. Does not mutate Android SQLite.
Not an official warning source. No radio controls.
"""
import argparse
import hashlib
import hmac
import json
import os
import sqlite3
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

PACKAGE = "ru.politech.mchsbridge.v2"
SOURCE = "io.citizens.security"
BASE = "https://mediarafraw.ru/api/safety-ingest/"
ADB = ("adb", "-s", "127.0.0.1:5557")
MAX_BACKOFF = 3600


def adb_bytes(path):
    p = subprocess.run([*ADB, "exec-out", "run-as", PACKAGE, "cat",
                        "databases/" + path], stdout=subprocess.PIPE,
                       stderr=subprocess.PIPE, timeout=20)
    if p.returncode:
        raise RuntimeError("ADB read failed for " + path + ": " + p.stderr.decode(errors="replace")[:120])
    return p.stdout


def snapshot_rows():
    # Only a read-only copy. Copy WAL + SHM where present for consistent SQLite recovery.
    with tempfile.TemporaryDirectory(prefix="mchs-read-") as tmp:
        base = Path(tmp) / "source.db"
        base.write_bytes(adb_bytes("mchs_bridge_v2.db"))
        for suffix in ("-wal", "-shm"):
            try:
                data = adb_bytes("mchs_bridge_v2.db" + suffix)
                if data:
                    (Path(tmp) / ("source.db" + suffix)).write_bytes(data)
            except RuntimeError:
                pass
        db = sqlite3.connect("file:" + base.as_posix() + "?mode=ro", uri=True)
        try:
            if db.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                raise RuntimeError("SQLite snapshot integrity error")
            return db.execute("""SELECT event_id, source_key, posted_at, title, body, channel_id
                                 FROM events ORDER BY created_at ASC LIMIT 1000""").fetchall()
        finally:
            db.close()


def payload(row):
    eid, source, posted, title, body, channel = row
    if not isinstance(source, str) or source.split("|")[1:2] != [SOURCE]:
        return None
    if not isinstance(eid, str) or len(eid) != 64 or any(c not in "0123456789abcdef" for c in eid.lower()):
        return None
    if not isinstance(posted, int) or not 1500000000000 < posted < int(time.time() * 1000) + 120000:
        return None
    if not isinstance(title, str) or not 1 <= len(title) <= 300:
        return None
    if not isinstance(body, str) or len(body) > 4000:
        return None
    if channel is not None and (not isinstance(channel, str) or len(channel) > 100):
        return None
    return {"eventId": eid, "title": title, "body": body,
            "channelId": channel,
            "occurredAt": datetime.fromtimestamp(posted / 1000, timezone.utc).isoformat().replace("+00:00", "Z"),
            "region": "Тульская область"}


def post(path, obj, key, connect_ip):
    raw = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode()
    stamp = str(int(time.time()))
    sig = hmac.new(key.encode(), stamp.encode() + b"." + raw, hashlib.sha256).hexdigest()
    cmd = ["curl", "--silent", "--show-error", "--proto", "=https",
           "--noproxy", "*", "--max-time", "12", "--resolve",
           f"mediarafraw.ru:443:{connect_ip}", "-X", "POST",
           "-H", "Content-Type: application/json",
           "-H", "X-MCHS-Timestamp: " + stamp,
           "-H", "X-MCHS-Signature: sha256=" + sig,
           "--data-binary", "@-", "-w", "\\n%{http_code}", BASE + path]
    result = subprocess.run(cmd, input=raw, capture_output=True, timeout=18)
    if result.returncode:
        raise RuntimeError("HTTPS transport failed: " + result.stderr.decode(errors="replace")[:100])
    data, _, status = result.stdout.rpartition(b"\n")
    if status != b"200":
        raise RuntimeError("Receiver returned HTTP " + status.decode(errors="replace"))
    return json.loads(data)


def state_db(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path)
    db.execute("""CREATE TABLE IF NOT EXISTS queue (
      event_id TEXT PRIMARY KEY, payload_json TEXT NOT NULL,
      attempt INTEGER NOT NULL DEFAULT 0, next_retry INTEGER NOT NULL DEFAULT 0,
      ack_id TEXT, ack_at INTEGER, last_error TEXT)""")
    db.commit()
    return db


def ingest_snapshot(db):
    rows = snapshot_rows()
    for row in rows:
        item = payload(row)
        if item:
            db.execute("INSERT OR IGNORE INTO queue(event_id,payload_json) VALUES (?,?)",
                       (item["eventId"], json.dumps(item, ensure_ascii=False)))
    db.commit()
    return len(rows)


def drain(db, key, ip, max_send=20):
    now = int(time.time())
    todo = db.execute("""SELECT event_id,payload_json,attempt FROM queue
      WHERE ack_at IS NULL AND next_retry<=? ORDER BY next_retry,event_id LIMIT ?""",
                      (now, max_send)).fetchall()
    for eid, raw, attempt in todo:
        try:
            reply = post("event", json.loads(raw), key, ip)
            if (reply.get("accepted") is not True or reply.get("eventId") != eid or
                reply.get("verified") is not False or not reply.get("id")):
                raise RuntimeError("Invalid/mismatched event ACK")
            db.execute("""UPDATE queue SET ack_id=?,ack_at=?,last_error=NULL
                          WHERE event_id=? AND ack_at IS NULL""",
                       (str(reply["id"]), int(time.time()), eid))
            print("ACK", eid[:12], "server_id", reply["id"], flush=True)
        except Exception as exc:
            delay = min(MAX_BACKOFF, 15 * 2 ** min(attempt, 8))
            db.execute("""UPDATE queue SET attempt=attempt+1,next_retry=?,last_error=?
                          WHERE event_id=? AND ack_at IS NULL""",
                       (int(time.time()) + delay, type(exc).__name__ + ": " + str(exc)[:120], eid))
            print("RETRY", eid[:12], type(exc).__name__, flush=True)
        db.commit()


def queue_telemetry(db):
    """Reported from durable VM state, not inferred from Android connectivity."""
    pending, failures, last_ack = db.execute(
        """SELECT COUNT(CASE WHEN ack_at IS NULL THEN 1 END),
                  COALESCE(SUM(CASE WHEN ack_at IS NULL THEN attempt ELSE 0 END), 0),
                  MAX(ack_at)
           FROM queue"""
    ).fetchone()
    metrics = {"queuedLocal": pending, "failedSends": failures}
    if last_ack is not None:
        metrics["lastSentAt"] = datetime.fromtimestamp(
            last_ack, timezone.utc).isoformat().replace("+00:00", "Z")
    return metrics


def heartbeat(key, ip, listener, telemetry=None):
    # Push REGISTERED cannot be inferred from running Android or an active listener.
    data = {"source": "mchs-android",
            "listener": "CONNECTED" if listener else "DISCONNECTED",
            "push": "UNKNOWN"}
    if telemetry is not None:
        data.update(telemetry)
    reply = post("heartbeat", data, key, ip)
    if reply.get("received") is not True:
        raise RuntimeError("Invalid heartbeat ACK")


def listener_running():
    p = subprocess.run([*ADB, "shell", "dumpsys", "notification"],
                       capture_output=True, text=True, timeout=15)
    return p.returncode == 0 and (PACKAGE + "/" + PACKAGE + ".MchsNotificationListener") in p.stdout.split("Live notification listeners", 1)[-1].split("Snoozed notification listeners", 1)[0]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--state", default=str(Path.home() / ".local/state/mchs-observer/queue.db"))
    parser.add_argument("--connect-ip", default="192.168.10.33")
    parser.add_argument("--once", action="store_true", help="Run one poll (default: loop every 60 s)")
    parser.add_argument("--dry-run", action="store_true", help="Read and enqueue only; never transmit")
    args = parser.parse_args()
    import ipaddress
    if not ipaddress.ip_address(args.connect_ip).is_private:
        parser.error("--connect-ip must be private")
    key = os.getenv("MCHS_INGEST_HMAC_KEY", "")
    if not args.dry_run and len(key) < 32:
        parser.error("MCHS_INGEST_HMAC_KEY missing")
    db = state_db(Path(args.state))
    last_snapshot_at = None
    while True:
        try:
            snapshot_ok = False
            try:
                count = ingest_snapshot(db)
                snapshot_ok = True
                last_snapshot_at = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
            except Exception as snapshot_error:
                print('SNAPSHOT_ERROR', type(snapshot_error).__name__, str(snapshot_error)[:100], flush=True)
                count = -1
            pending = db.execute("SELECT COUNT(*) FROM queue WHERE ack_at IS NULL").fetchone()[0]
            print("SNAPSHOT", count, "pending", pending, "dry_run", args.dry_run, flush=True)
            if not args.dry_run:
                drain(db, key, args.connect_ip)
                metrics = queue_telemetry(db)
                metrics['snapshotOk'] = snapshot_ok
                if last_snapshot_at:
                    metrics['snapshotAt'] = last_snapshot_at
                heartbeat(key, args.connect_ip, listener_running(), metrics)
                print("HEARTBEAT_ACK", flush=True)
        except Exception as exc:
            print("POLL_ERROR", type(exc).__name__, str(exc)[:140], flush=True)
        if args.once:
            break
        time.sleep(60)


if __name__ == "__main__":
    main()
