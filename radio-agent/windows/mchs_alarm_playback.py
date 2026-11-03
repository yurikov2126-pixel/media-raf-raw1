"""Event-scoped ALARM playback worker for a physically isolated Windows test output.

A preverified local file is required. Callers must independently authorize
the event, prove output isolation, and keep the watchdog heartbeat alive.
"""
import subprocess
import threading
import time
from collections import deque

class AlarmPlaybackSession:
    def __init__(self, launch, *, heartbeat=lambda: True, isolation_verified=False,
                 clock=time.monotonic, sleep=time.sleep):
        self.launch=launch
        self.heartbeat=heartbeat
        self.isolation_verified=isolation_verified
        self.clock=clock
        self.sleep=sleep
        self._lock=threading.Lock()
        self._cancel=threading.Event()
        self._process=None
        self._thread=None
        self._event_id=None
        self._status='IDLE'
        self._completed=0
        self._failure_reason=None
        self._expected_repeats=0
        self._recent_event_ids=deque(maxlen=250)
        self._recent_event_set=set()

    def status(self):
        with self._lock:
            return dict(eventId=self._event_id,state=self._status,
                        completedRepeats=self._completed,
                        failureReason=self._failure_reason,
                        expectedRepeats=self._expected_repeats,
                        naturalCompletion=(self._status=='COMPLETED' and
                                           self._completed==self._expected_repeats and
                                           self._failure_reason is None and
                                           self._process is None),
                        processRunning=(self._process is not None and
                                        self._process.poll() is None))

    def start(self, *, event_id, file, repeats, authorized=False):
        if not self.isolation_verified or not authorized:
            return {'accepted':False,'reason':'ISOLATION_OR_AUTHORIZATION_MISSING'}
        if not isinstance(event_id,str) or not event_id or not file.is_file():
            return {'accepted':False,'reason':'INVALID_EVENT_OR_FILE'}
        if type(repeats) is not int or repeats not in range(1,6):
            return {'accepted':False,'reason':'INVALID_REPEATS'}
        with self._lock:
            if self._thread is not None and self._thread.is_alive():
                return {'accepted':False,'reason':'BUSY'}
            if event_id in self._recent_event_set:
                return {'accepted':False,'reason':'REPLAYED_EVENT'}
            if len(self._recent_event_ids)==self._recent_event_ids.maxlen:
                self._recent_event_set.discard(self._recent_event_ids.popleft())
            self._recent_event_ids.append(event_id)
            self._recent_event_set.add(event_id)
            self._event_id=event_id
            self._completed=0
            self._expected_repeats=repeats
            self._failure_reason=None
            self._status='STARTING'
            self._cancel.clear()
            self._thread=threading.Thread(target=self._run,args=(file,repeats),daemon=True)
            self._thread.start()
            return {'accepted':True,'reason':None}

    def _run(self,file,repeats):
        try:
            for _ in range(repeats):
                if self._cancel.is_set() or not self.heartbeat():
                    raise RuntimeError('STOP_OR_WATCHDOG')
                process=self.launch(file)
                with self._lock:
                    self._process=process
                    self._status='PLAYING'
                # STOP may arrive while launch() blocks; never let that
                # late child escape the cancellation watchdog.
                if self._cancel.is_set() or not self.heartbeat():
                    raise RuntimeError('STOP_OR_WATCHDOG')
                while process.poll() is None:
                    if self._cancel.is_set() or not self.heartbeat():
                        raise RuntimeError('STOP_OR_WATCHDOG')
                    self.sleep(0.1)
                if process.returncode != 0:
                    raise RuntimeError('PLAYER_FAILED')
                with self._lock:
                    self._process=None
                    self._completed+=1
            with self._lock:
                self._status='STOPPED' if self._cancel.is_set() else 'COMPLETED'
        except Exception as error:
            with self._lock:
                self._failure_reason=type(error).__name__
                self._status='STOPPED'
        finally:
            with self._lock:
                process=self._process
                self._process=None
            if process is not None and process.poll() is None:
                process.terminate()
                try:process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=3)

    def stop(self):
        self._cancel.set()
        with self._lock:
            process=self._process
            thread=self._thread
        if process is not None and process.poll() is None:
            try:
                process.terminate()
            except OSError:
                pass
        if thread is not None and thread is not threading.current_thread():
            thread.join(timeout=4)
        with self._lock:
            still_running=self._thread is not None and self._thread.is_alive()
            if not still_running and self._status in ('STARTING','PLAYING'):
                self._status='STOPPED'
            state=dict(eventId=self._event_id,state=self._status,
                       completedRepeats=self._completed,
                       failureReason=self._failure_reason,
                       expectedRepeats=self._expected_repeats,
                       naturalCompletion=(self._status=='COMPLETED' and
                                          self._completed==self._expected_repeats and
                                          self._failure_reason is None and
                                          not still_running),
                       processRunning=(self._process is not None and
                                       self._process.poll() is None))
            state['stopConfirmed']=not still_running and (
                self._process is None or self._process.poll() is not None)
        return state
