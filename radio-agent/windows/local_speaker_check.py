"""Operator-only local speaker check. No alerts, network, ESP32 or PA power control."""
import subprocess
import threading

MAX_SECONDS = 10
# Fixed text; never permit arbitrary operator input or an actual emergency alarm.
TEXT = "Внимание. Это учебная проверка звукового оборудования. Это не тревога."


class LocalSpeakerCheck:
    def __init__(self):
        self._lock = threading.Lock()
        self._process = None
        self._timer = None

    def start(self):
        with self._lock:
            if self._process is not None:
                return False
            # Windows built-in speech; a single bounded process, no loop.
            script = (
                "Add-Type -AssemblyName System.Speech; "
                "$s=New-Object System.Speech.Synthesis.SpeechSynthesizer; "
                "$s.Volume=30; "
                "$s.Speak('"+TEXT+"');"
            )
            proc = subprocess.Popen(
                ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script],
                stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
            self._process = proc
            self._timer = threading.Timer(MAX_SECONDS, self.stop)
            self._timer.daemon = True
            self._timer.start()
            threading.Thread(target=self._reap, args=(proc,), daemon=True).start()
            return True

    def _reap(self, proc):
        proc.wait()
        with self._lock:
            if self._process is proc:
                self._process = None
                if self._timer:
                    self._timer.cancel()
                    self._timer = None

    def stop(self):
        with self._lock:
            proc = self._process
            self._process = None
            if self._timer:
                self._timer.cancel()
                self._timer = None
        if proc and proc.poll() is None:
            proc.kill()

    @property
    def active(self):
        with self._lock:
            return self._process is not None and self._process.poll() is None
