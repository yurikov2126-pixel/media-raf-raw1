#!/usr/bin/env python3
"""Experimental single-output dual-decoder radio receiver. HEADPHONES ONLY.

Does not touch VLC pilot, public address, relays or emergency interfaces.
"""
import argparse
from collections import deque
from datetime import datetime
import json
import os
from pathlib import Path
import signal
import subprocess
import threading
import time
from urllib.request import Request, urlopen

import numpy as np
import sounddevice as sd

from central_playout import cached_file, local_cursor
from sync_agent import sync

RATE = 48000
CHANNELS = 2
BLOCK = 960  # 20 ms
BYTES = BLOCK * CHANNELS * 4
STOP = threading.Event()


class PCMQueue:
    """Bounded prebuffer. Never lets a slow consumer stall decoding."""
    def __init__(self, capacity=50):
        self.blocks = deque(maxlen=capacity)
        self.lock = threading.Lock()
        self.updated = 0.0

    def push(self, block):
        if len(block) != BYTES:
            return
        with self.lock:
            self.blocks.append(np.frombuffer(block, dtype="<f4").reshape(BLOCK, CHANNELS).copy())
            self.updated = time.monotonic()

    def take(self):
        with self.lock:
            return self.blocks.popleft() if self.blocks else None

    def clear(self):
        with self.lock:
            self.blocks.clear()

    def buffered(self):
        with self.lock:
            return len(self.blocks)


class Selector:
    """One output: select source per block, with a short fade on source change."""
    def __init__(self):
        self.central = PCMQueue()
        self.local = PCMQueue()
        self.active = "NONE"
        self.transitions = 0

    def render(self):
        now = time.monotonic()
        central_ok = (now - self.central.updated < 0.32 and self.central.buffered() >= 2)
        local_ok = (now - self.local.updated < 0.6 and self.local.buffered() >= 1)
        choice = "CENTRAL" if central_ok else "LOCAL" if local_ok else "NONE"
        q = self.central if choice == "CENTRAL" else self.local
        samples = q.take() if choice != "NONE" else None
        if samples is None:
            choice = "NONE"
            samples = np.zeros((BLOCK, CHANNELS), dtype=np.float32)
        if self.active != choice:
            self.transitions += 1
            # An instant fade-in limits clicks; no claim of sample-accurate crossfade.
            samples = samples * np.linspace(0.0, 1.0, BLOCK, dtype=np.float32)[:, None]
            self.active = choice
        return samples, choice


def decoder(ffmpeg, input_args):
    return subprocess.Popen([ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin",
                             *input_args, "-vn", "-ac", "2", "-ar", str(RATE),
                             "-f", "f32le", "pipe:1"],
                            stdin=subprocess.PIPE if input_args == ["-i", "pipe:0"] else subprocess.DEVNULL,
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                            start_new_session=True)


def kill(proc):
    if proc is None:
        return
    try:
        proc.terminate()
        proc.wait(timeout=1)
    except (OSError, subprocess.TimeoutExpired):
        try: proc.kill()
        except OSError: pass


def ingest_pcm(proc, queue, done):
    try:
        while not STOP.is_set() and not done.is_set():
            block = proc.stdout.read(BYTES)
            if len(block) != BYTES:
                break
            queue.push(block)
    finally:
        done.set()


def central_loop(base, token, ffmpeg, queue):
    route = base.rstrip("/") + "/api/radio-agent/agent/stream"
    while not STOP.is_set():
        proc = None
        try:
            req = Request(route, headers={"Authorization": "Bearer " + token})
            with urlopen(req, timeout=2.5) as response:
                if response.status != 200 or "audio/" not in response.headers.get("Content-Type", ""):
                    raise RuntimeError("Invalid MP3 response")
                proc = decoder(ffmpeg, ["-i", "pipe:0"])
                done = threading.Event()
                thread = threading.Thread(target=ingest_pcm, args=(proc,queue,done), daemon=True)
                thread.start()
                print("CENTRAL_CONNECTED", flush=True)
                while not STOP.is_set() and not done.is_set():
                    piece = response.read(4096)
                    if not piece:
                        break
                    try:
                        proc.stdin.write(piece)
                        proc.stdin.flush()
                    except (BrokenPipeError, OSError):
                        break
        except Exception as exc:
            print("CENTRAL_UNAVAILABLE", type(exc).__name__, flush=True)
        finally:
            kill(proc)
            queue.clear()
        STOP.wait(1.5)


def local_loop(data_dir, ffmpeg, queue):
    snapshot_file = data_dir / "snapshot.json"
    cache = data_dir / "cache"
    proc = None
    current_id = None
    current_until = 0.0
    done = None
    last_revision = None
    while not STOP.is_set():
        try:
            snapshot = json.loads(snapshot_file.read_text(encoding="utf-8"))
            rev = snapshot.get("revision")
            cursor = local_cursor(snapshot, time.time())
            if not cursor:
                kill(proc)
                proc = None
                current_id = None
                queue.clear()
                STOP.wait(0.4)
                continue
            track, offset, remaining = cursor
            changed = proc is None or proc.poll() is not None or current_id != track["id"] or time.monotonic() >= current_until or last_revision != rev
            if changed:
                kill(proc)
                queue.clear()
                file = cached_file(cache, track)
                if file is None:
                    print("LOCAL_CACHE_UNAVAILABLE", track["id"], flush=True)
                    proc = None
                    STOP.wait(1)
                    continue
                proc = decoder(ffmpeg, ["-re", "-ss", "%.3f" % offset, "-i", str(file)])
                done = threading.Event()
                threading.Thread(target=ingest_pcm, args=(proc,queue,done), daemon=True).start()
                current_id = track["id"]
                current_until = time.monotonic() + max(0.1, remaining)
                last_revision = rev
                print("LOCAL_PREPARED", current_id, "offset", round(offset,1), flush=True)
        except (OSError, ValueError, KeyError) as exc:
            print("LOCAL_UNAVAILABLE", type(exc).__name__, flush=True)
        STOP.wait(0.4)
    kill(proc)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--server", default="https://mediarafraw.ru")
    p.add_argument("--data-dir", required=True)
    p.add_argument("--ffmpeg", default="/opt/homebrew/bin/ffmpeg")
    p.add_argument("--headphones-only", action="store_true")
    args = p.parse_args()
    token = os.environ.get("RADIO_AGENT_TOKEN", "")
    if not args.server.startswith("https://") or not args.headphones_only or not token.startswith("rr_"):
        p.error("HTTPS, RadioDevice token and explicit headphones-only flag required")
    if not Path(args.ffmpeg).is_file():
        p.error("FFmpeg missing. Set --ffmpeg to installed binary")
    root = Path(args.data_dir).expanduser().resolve()
    if not (root / "snapshot.json").is_file():
        p.error("Synchronize the schedule and cache first")
    # Validate playback permission before producing any audio.
    request = Request(args.server.rstrip("/") + "/api/radio-agent/agent/status",
                      headers={"Authorization": "Bearer " + token})
    with urlopen(request, timeout=5) as resp:
        if json.load(resp).get("playbackEnabled") is not True:
            p.error("Server has not enabled pilot playback")
    selector = Selector()
    workers = [
        threading.Thread(target=central_loop, args=(args.server,token,args.ffmpeg,selector.central), daemon=True),
        threading.Thread(target=local_loop, args=(root,args.ffmpeg,selector.local), daemon=True),
    ]
    for thread in workers:
        thread.start()
    last = [None]
    def callback(outdata, frames, _time_info, status):
        if frames != BLOCK:
            outdata.fill(0)
            return
        audio, mode = selector.render()
        outdata[:] = audio
        if mode != last[0]:
            last[0] = mode
            print("OUTPUT", mode, flush=True)
    try:
        with sd.OutputStream(samplerate=RATE, channels=CHANNELS, dtype="float32",
                             blocksize=BLOCK, latency="low", callback=callback):
            print("HOT_STANDBY_READY · TEST HEADPHONES ONLY", flush=True)
            while not STOP.wait(0.25):
                pass
    finally:
        STOP.set()


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda *_: STOP.set())
    signal.signal(signal.SIGINT, lambda *_: STOP.set())
    main()
