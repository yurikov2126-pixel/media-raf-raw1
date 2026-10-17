#!/usr/bin/env python3
"""Opt-in Mac central radio test: authorized stream, local cache failover, no hardware."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from sync_agent import fetch, sync

STOP = threading.Event()


def utc(value):
    from datetime import datetime
    return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()


def local_cursor(snapshot, now):
    """Find track at its absolute scheduled position; never start a slot from zero."""
    for slot in sorted(snapshot.get("slots", []), key=lambda s: s["startAt"]):
        start, end = utc(slot["startAt"]), utc(slot["endAt"])
        if not start <= now < end:
            continue
        elapsed = (now - start) * 1000
        for track in slot["tracks"]:
            length = track.get("durationMs", 0)
            if not isinstance(length, (int, float)) or length <= 0:
                return None
            if elapsed < length:
                return (track, elapsed / 1000, min(end - now, (length - elapsed) / 1000))
            elapsed -= length
    return None


def cached_file(cache, track):
    file = cache / (track["id"] + ".audio")
    if not file.is_file():
        return None
    sha = hashlib.sha256()
    with file.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            sha.update(block)
    return file if sha.hexdigest() == track.get("sha256") else None


def stop_player(proc):
    if proc is None or proc.poll() is not None:
        return
    try:
        os.killpg(proc.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        proc.wait(timeout=3)
    except subprocess.TimeoutExpired:
        os.killpg(proc.pid, signal.SIGKILL)
        proc.wait()


class Relay(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, server, token):
        self.upstream = server.rstrip("/") + "/api/radio-agent/agent/stream"
        self.token = token
        self.last_data = 0
        self.failed = threading.Event()
        super().__init__(("127.0.0.1", 0), RelayHandler)


class RelayHandler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):
        if self.path != "/listen":
            self.send_error(404)
            return
        req = Request(self.server.upstream, headers={"Authorization": "Bearer " + self.server.token})
        try:
            with urlopen(req, timeout=8) as source:
                if source.status != 200 or "audio/" not in source.headers.get("Content-Type", ""):
                    raise RuntimeError("Unexpected radio stream response")
                self.send_response(200)
                self.send_header("Content-Type", "audio/mpeg")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                while not STOP.is_set():
                    block = source.read(8192)
                    if not block:
                        break
                    self.wfile.write(block)
                    self.server.last_data = time.monotonic()
        except (OSError, HTTPError, URLError, RuntimeError) as exc:
            if not isinstance(exc, (BrokenPipeError, ConnectionResetError)):
                print("STREAM_ERROR", type(exc).__name__, flush=True)
            self.server.failed.set()
        finally:
            self.server.failed.set()


def check_permission(server, token):
    with fetch(server, token, "/api/radio-agent/agent/status") as response:
        status = json.load(response)
    return status.get("mode") == "PILOT" and status.get("playbackEnabled") is True


def probe(server, token):
    """Confirm authenticated MP3 bytes, not merely a successful HTTP handshake."""
    req = Request(server.rstrip("/") + "/api/radio-agent/agent/stream",
                  headers={"Authorization": "Bearer " + token})
    with urlopen(req, timeout=6) as response:
        if response.status != 200 or "audio/" not in response.headers.get("Content-Type", ""):
            return False
        return len(response.read(2048)) >= 1024


def player(vlc, *args):
    return subprocess.Popen([str(vlc), "--intf", "dummy", "--no-video",
                             "--play-and-exit", "--no-one-instance", *args],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                            start_new_session=True)


def run(args, token):
    base = Path(args.data_dir).expanduser().resolve()
    base.mkdir(parents=True, exist_ok=True)
    cache = base / "cache"
    # Keep last verified snapshot for an outage; sync only when connected.
    snapshot_path = base / "snapshot.json"
    snapshot = None
    if snapshot_path.exists():
        try:
            snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            pass
    relay = Relay(args.server, token)
    thread = threading.Thread(target=relay.serve_forever, daemon=True)
    thread.start()
    primary = None
    fallback = None
    fallback_id = None
    fallback_until = 0
    next_attempt = 0
    next_sync = 0
    try:
        if not check_permission(args.server, token):
            raise RuntimeError("Device pilot playback not permitted")
        while not STOP.is_set():
            now = time.monotonic()
            if now >= next_attempt:
                next_attempt = now + 6
                try:
                    if not check_permission(args.server, token):
                        raise PermissionError("Playback permission revoked")
                    if now >= next_sync:
                        snapshot = sync(args.server, token, base)
                        next_sync = now + 120
                    if probe(args.server, token):
                        if primary is None or primary.poll() is not None:
                            stop_player(fallback)
                            fallback = None
                            fallback_id = None
                            relay.failed.clear()
                            relay.last_data = time.monotonic()
                            url = "http://127.0.0.1:%d/listen" % relay.server_address[1]
                            primary = player(args.vlc, "--network-caching=800", url)
                            print("PRIMARY_STREAM", flush=True)
                except PermissionError:
                    raise
                except (OSError, URLError, ValueError, RuntimeError) as exc:
                    print("PRIMARY_UNAVAILABLE", type(exc).__name__, flush=True)
            # If relay stalls, immediately stop central VLC, then use cached timeline.
            if primary is not None and (primary.poll() is not None or
                    relay.failed.is_set() or now - relay.last_data > 8):
                stop_player(primary)
                primary = None
                relay.failed.clear()
                print("FALLBACK", flush=True)
            if primary is None:
                cursor = local_cursor(snapshot or {"slots": []}, time.time())
                if cursor:
                    track, offset, remaining = cursor
                    file = cached_file(cache, track)
                    if file:
                        if (fallback is None or fallback.poll() is not None or
                                fallback_id != track["id"] or now >= fallback_until):
                            stop_player(fallback)
                            fallback_id = track["id"]
                            fallback_until = now + max(0, remaining)
                            fallback = player(args.vlc, "--start-time=%.3f" % offset, str(file))
                            print("LOCAL_TRACK", track["id"], "offset", round(offset, 1), flush=True)
                    else:
                        stop_player(fallback)
                        fallback = None
                        fallback_id = None
                        print("CACHE_MISSING", track["id"], flush=True)
                else:
                    stop_player(fallback)
                    fallback = None
                    fallback_id = None
            STOP.wait(0.5)
    finally:
        stop_player(primary)
        stop_player(fallback)
        relay.shutdown()
        relay.server_close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--server", default="https://mediarafraw.ru")
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--vlc", required=True)
    parser.add_argument("--enable-headphones-test", action="store_true")
    args = parser.parse_args()
    if not args.server.startswith("https://") or not args.enable_headphones_test:
        parser.error("HTTPS and explicit headphones test consent required")
    if not Path(args.vlc).is_file():
        parser.error("VLC executable missing")
    token = os.environ.get("RADIO_AGENT_TOKEN", "").strip()
    if not token.startswith("rr_"):
        parser.error("RADIO_AGENT_TOKEN missing")
    signal.signal(signal.SIGTERM, lambda *_: STOP.set())
    signal.signal(signal.SIGINT, lambda *_: STOP.set())
    run(args, token)


if __name__ == "__main__":
    main()
