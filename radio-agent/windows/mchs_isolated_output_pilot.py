#!/usr/bin/env python3
"""MANUAL, single-run isolated Windows Agent lab audio preview.

No import of central_playout, GUI, ESP32, power or autostart services.
The output is the Windows DEFAULT device: physical disconnection of PA is required.
"""
import argparse
import os
import subprocess
import threading
import time
import struct
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

MAX_PCM_BYTES = 24000 * 2 * 60
STOP = threading.Event()


def wav_header():
    """RIFF header for a bounded 60-second 24kHz mono PCM16 audio stream."""
    data_size = MAX_PCM_BYTES
    return (
        b"RIFF" + struct.pack("<I", 36 + data_size) +
        b"WAVEfmt " + struct.pack("<IHHIIHH", 16, 1, 1, 24000, 48000, 2, 16) +
        b"data" + struct.pack("<I", data_size)
    )


class LocalMonitor(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, server_url, token):
        self.server_url = server_url.rstrip("/")
        self.token = token
        self.closing = threading.Event()
        self.active = threading.Event()
        self.connected_at = None
        self.last_pcm_at = None
        self.metrics_lock = threading.Lock()
        super().__init__(("127.0.0.1", 0), Handler)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        return

    def do_GET(self):
        if self.path != "/lab.wav":
            self.send_error(404)
            return
        if self.server.active.is_set():
            self.send_error(409)
            return
        self.server.active.set()
        request = Request(
            self.server.server_url + "/api/radio-agent/agent/mchs-lab-pcm",
            headers={"Authorization": "Bearer " + self.server.token},
        )
        try:
            with urlopen(request, timeout=8) as upstream:
                if upstream.status != 200 or upstream.headers.get("X-Lab-Format") != "s16le;rate=24000;channels=1":
                    print("LAB_STREAM_WRONG_FORMAT_OR_STATUS", upstream.status, flush=True)
                    self.send_error(502)
                    return
                self.send_response(200)
                self.send_header("Content-Type", "audio/wav")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                with self.server.metrics_lock:
                    self.server.connected_at = time.monotonic()
                    self.server.last_pcm_at = self.server.connected_at
                print("LAB_STREAM_CONNECTED", flush=True)
                self.wfile.write(wav_header())
                total = 0
                while not STOP.is_set() and total < MAX_PCM_BYTES:
                    block = upstream.read(min(1920, MAX_PCM_BYTES - total))
                    if not block:
                        break
                    self.wfile.write(block)
                    with self.server.metrics_lock:
                        self.server.last_pcm_at = time.monotonic()
                    total += len(block)
        except HTTPError as error:
            # Operator can distinguish a 403 device/flag issue from unavailable PCM.
            if not self.server.closing.is_set():
                print("LAB_STREAM_HTTP_ERROR", error.code, flush=True)
            try:
                self.send_error(502)
            except OSError:
                pass
        except (OSError, ValueError, URLError) as error:
            if self.server.closing.is_set() or STOP.is_set():
                print("LAB_STREAM_CLOSED_BY_OPERATOR", flush=True)
            else:
                print("LAB_STREAM_TRANSPORT_ERROR", type(error).__name__, flush=True)
        finally:
            self.server.active.clear()


def main():
    parser = argparse.ArgumentParser(description="Manual, physically isolated Windows lab output")
    parser.add_argument("--server", default="https://mediarafraw.ru")
    parser.add_argument("--vlc", required=True, help="Absolute VLC.exe path")
    parser.add_argument("--physical-disconnect-confirmation", required=True,
                        help="Type PA_DISCONNECTED to confirm cable separation")
    args = parser.parse_args()
    if args.physical_disconnect_confirmation != "PA_DISCONNECTED":
        parser.error("PA audio cable must be physically disconnected before testing")
    if not args.server.startswith("https://") or args.server.count("/") < 2:
        parser.error("HTTPS server is required")
    vlc = Path(args.vlc).resolve()
    if not vlc.is_file() or vlc.name.lower() != "vlc.exe":
        parser.error("The full VLC.exe path is required")
    token = os.environ.get("RADIO_AGENT_TOKEN", "")
    if not token.startswith("rr_") or len(token) != 67:
        parser.error("Registered RADIO_AGENT_TOKEN required in environment")
    print("LAB AUDIO: Windows DEFAULT output. Main Agent and amplifier must be OFF.", flush=True)
    relay = LocalMonitor(args.server, token)
    thread = threading.Thread(target=relay.serve_forever, daemon=True)
    thread.start()
    url = "http://127.0.0.1:%d/lab.wav" % relay.server_address[1]
    process = None
    try:
        process = subprocess.Popen(
            [str(vlc), "--intf", "dummy", "--no-video", "--no-one-instance",
             "--no-repeat", "--no-loop", "--play-and-exit", "--network-caching=120", url],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print("LAB_OUTPUT_ACTIVE for at most 65s; Ctrl+C stops playback", flush=True)
        try:
            process.wait(timeout=65)
        except subprocess.TimeoutExpired:
            print("LAB_LIMIT_REACHED", flush=True)
    except KeyboardInterrupt:
        print("LAB_STOP_BY_OPERATOR", flush=True)
    finally:
        STOP.set()
        if process and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=3)
        relay.shutdown()
        relay.server_close()
        print("LAB_OUTPUT_STOPPED", flush=True)


if __name__ == "__main__":
    main()
