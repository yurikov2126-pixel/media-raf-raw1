"""Authenticated, best-effort Windows playback telemetry.

Never carries tokens in JSON or log output. This endpoint is diagnostic only:
a living VLC process is not proof of an audible Windows sound-card output.
"""
import json
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ALLOWED = {"PLAYING", "BUFFERING", "STOPPED", "ERROR", "UNKNOWN"}

def playback_report(primary, fallback, relay, now=None):
    """Report what the agent can actually observe, never claim acoustic proof."""
    now = time.monotonic() if now is None else now
    alive_primary = primary is not None and primary.poll() is None
    alive_reserve = fallback is not None and fallback.poll() is None
    failed = bool(relay.failed.is_set())
    age = max(0.0, now - relay.last_data) if relay.last_data > 0 else None
    recent = age is not None and age <= 4.0
    if alive_primary and recent and not failed:
        playback = "PLAYING"
    elif alive_reserve:
        playback = "PLAYING"
    elif alive_primary and not failed:
        playback = "BUFFERING"
    elif failed:
        playback = "ERROR"
    else:
        playback = "STOPPED"
    # Packet freshness is only meaningful for the central stream, not local cache.
    return {
        "playback": playback,
        "outputDevice": "VLC (устройство вывода не подтверждено)",
        "lastPacketAgeMs": min(86400000, int(age * 1000)) if alive_primary and age is not None else None,
        "error": "LOCAL_STREAM_FAILED" if failed and not alive_reserve else "",
    }

def send_playback_report(server, token, report, timeout=3):
    body=json.dumps(report).encode("utf-8")
    request=Request(
        server.rstrip("/") + "/api/radio-agent/agent/audio-telemetry",
        data=body,
        headers={"Authorization":"Bearer "+token, "Content-Type":"application/json"},
        method="POST",
    )
    with urlopen(request, timeout=timeout) as response:
        return response.status == 200

def async_playback_report(server, token, report):
    """The caller schedules this on a daemon thread, never on the VLC/audio path."""
    try:
        return send_playback_report(server, token, report)
    except (HTTPError, URLError, OSError, TimeoutError, ValueError):
        return False
