#!/usr/bin/env python3
"""Headphones-only Windows pilot: authenticated central stream -> verified offline cache.

Never starts on boot, controls amplifiers, relays, ESP32 or PA. Requires an
explicit command-line consent and per-device server playback authorization.
"""
import argparse
import json
import os
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from standby_plan import standby_selection
from sync_agent import sync
from mchs_alarm_playback import AlarmPlaybackSession
from mchs_stop_evidence import can_confirm_local_stop
from esp32_local import send_heartbeat
from audio_telemetry import playback_report, async_playback_report
from audio_output_probe import inspect_outputs
from mchs_readiness import assess_mchs_readiness
from mchs_lab_chain_diagnostics import assess_lab_chain
from mchs_lab_chain_transition import LabChainTransition
from mchs_output_preflight import evaluate_isolated_output_preflight
from mchs_transition_shadow import MchsTransitionShadow
from mchs_isolated_output_pilot import LocalMonitor
from mchs_trial_watchdog import trial_stop_reason
from mchs_lab_trigger import next_lab_trigger
from mchs_auto_trial_fence import queued_auto_trial_current
from mchs_lab_resume import should_stop_auto_lab
from mchs_lab_observer_failsafe import observer_failsafe
from mchs_agent_stop_evidence import trial_stop_evidence
from mchs_central_return_monitor import CentralReturnMonitor
from mchs_lab_end_evidence import assess_lab_trial_end
from mchs_integrated_headphones_cycle import IntegratedHeadphonesCycle
from mchs_event_admission import EventAdmissionLedger
from mchs_event_audio_controller import IsolatedEventAudioController
from mchs_relay_preroll import SYNTHETIC, preroll_decision
from mchs_event_observation import make_event_observation, post_event_observation
from mchs_isolated_readiness import make_isolated_readiness, post_isolated_readiness
from mchs_two_stage_headphones_pilot import verify_local_training_wav

STOP = threading.Event()
MCHS_AUDIO_START = threading.Event()
MCHS_AUDIO_STOP = threading.Event()
MCHS_AUDIO_ARMED = threading.Event()
MCHS_LAB_ONE_SHOT = threading.Event()
MCHS_LAB_AUTO_ACTIVE = threading.Event()
MCHS_LAB_ONE_SHOT_EXPIRES = {'at': 0.0}
MCHS_LAB_ONE_SHOT_LOCK = threading.Lock()
MCHS_LAB_OBSERVED = {'phase':None,'revision':None,'at':0.0,'ready':False}
MCHS_AUTO_LAB_EXPECTED_REVISION = {'value':None}
MCHS_HALT_RECEIPT_EPOCH = {'last': None}
PLAYBACK_STATE = {'mode':'STOPPED','lastAuthorized':0.0,'offlineGrace':900,'streamLastSeen':0.0,'broadcastRunning':False}


def get_status(server, token):
    request=Request(server.rstrip('/')+'/api/radio-agent/agent/status',
                    headers={'Authorization':'Bearer '+token})
    with urlopen(request,timeout=4) as response:
        return json.load(response)


def permitted(status):
    return status.get('mode')=='PILOT' and status.get('playbackEnabled') is True



def send_mchs_observer_report(server, token, report):
    """Best-effort telemetry only; never blocks or controls playback."""
    payload=json.dumps(report).encode('utf-8')
    request=Request(server.rstrip('/')+'/api/radio-agent/agent/mchs-observer-report',
                    data=payload,headers={'Authorization':'Bearer '+token,
                    'Content-Type':'application/json'},method='POST')
    with urlopen(request,timeout=3) as response:
        return response.status==200


def send_mchs_trial_vlc_state(server, token, state, process_running):
    """Report observed local trial VLC process state, not an MCHS event ACK."""
    payload=json.dumps({'state':state,'processRunning':bool(process_running)}).encode('utf-8')
    req=Request(server.rstrip('/')+'/api/radio-agent/agent/mchs-trial-vlc-state',
                data=payload,headers={'Authorization':'Bearer '+token,
                'Content-Type':'application/json'},method='POST')
    with urlopen(req,timeout=3) as response:
        return response.status==200


def send_mchs_trial_process_stop(server, token, report):
    """Report only the isolated VLC process after local shutdown."""
    req=Request(server.rstrip('/')+'/api/radio-agent/agent/mchs-trial-process-stop',
                data=json.dumps(report).encode('utf-8'),
                headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'},
                method='POST')
    with urlopen(req,timeout=3) as response:
        return response.status==200


def read_mchs_observer(server, token):
    """Read-only lab state. This function must never touch VLC or power control."""
    request=Request(server.rstrip('/')+'/api/radio-agent/agent/mchs-integration-observe',
                    headers={'Authorization':'Bearer '+token})
    with urlopen(request,timeout=3) as response:
        return json.load(response)

def acknowledge_mchs_halt(server, token):
    """Enforce local trial STOP on HALT; ordinary station playback and PA remain untouched."""
    base=server.rstrip('/')
    headers={'Authorization':'Bearer '+token}
    with urlopen(Request(base+'/api/radio-agent/agent/mchs-dispatch-halt',
                         headers=headers),timeout=3) as response:
        state=json.load(response)
    epoch=state.get('haltEpoch')
    if state.get('halted') is not True or not isinstance(epoch,str) or not epoch:
        return
    # HALT immediately cancels any pending or running isolated trial.
    # Do not stop the regular station stream or touch amplifier / ESP32.
    if MCHS_AUDIO_ARMED.is_set() or MCHS_AUDIO_START.is_set() or PLAYBACK_STATE.get('mode')=='MCHS_LAB_TRIAL':
        MCHS_AUDIO_STOP.set()
        MCHS_AUDIO_START.clear()
        MCHS_AUDIO_ARMED.clear()
        MCHS_LAB_ONE_SHOT.clear()
        print('MCHS_HALT_TRIAL_STOP_REQUESTED',flush=True)
    if MCHS_HALT_RECEIPT_EPOCH['last']==epoch:
        return
    payload=json.dumps({'haltEpoch':epoch}).encode('utf-8')
    req=Request(base+'/api/radio-agent/agent/mchs-dispatch-halt-received',
                data=payload,headers={**headers,'Content-Type':'application/json'},
                method='POST')
    with urlopen(req,timeout=3) as response:
        if response.status==200:
            MCHS_HALT_RECEIPT_EPOCH['last']=epoch
            print('MCHS_DISPATCH_HALT_RECEIPT_ONLY',flush=True)


MCHS_EXECUTION_LAST_STATUS = {'haltEpoch': None, 'pendingStop': None, 'lastStopSequence': 0}
MCHS_EXECUTION_RECEIPT_LOCK = threading.Lock()

def send_mchs_device_stop_receipt(server, token, command):
    """Acknowledge only after the isolated VLC process has exited."""
    payload=json.dumps({'action':'STOP','sequence':command['sequence'],
        'eventId':command['eventId'],'eventType':command['eventType'],
        'confirmed':True,'playbackState':'STOPPED',
        'confirmedAt':__import__('datetime').datetime.now(
            __import__('datetime').timezone.utc).isoformat().replace('+00:00','Z'),
        'localTrialStoppedConfirmed':True}).encode('utf-8')
    request=Request(server.rstrip('/')+'/api/radio-agent/agent/mchs-device-stop-received',
                    data=payload,headers={'Authorization':'Bearer '+token,
                    'Content-Type':'application/json'},method='POST')
    with urlopen(request,timeout=3) as response:
        return response.status==200



def report_mchs_playback_session(server,token,alarm_session):
    """Report observed local VLC process state, never physical PA state."""
    state=alarm_session.status()
    payload=json.dumps({'version':2,'eventId':state['eventId'],
        'state':state['state'],
        'completedRepeats':state['completedRepeats'],
        'expectedRepeats':state['expectedRepeats'],
        'naturalCompletion':state['naturalCompletion'],
        'processRunning':state['processRunning'],
        'failureReason':state['failureReason']}).encode('utf-8')
    request=Request(server.rstrip('/')+'/api/radio-agent/agent/mchs-playback-session-status',
                    data=payload,headers={'Authorization':'Bearer '+token,
                    'Content-Type':'application/json'},method='POST')
    with urlopen(request,timeout=3) as response:
        return response.status==200


def poll_mchs_execution_command(server, token, alarm_session=None):
    """Authenticated command transport. Reject START until event-bound playback
    and emergency STOP telemetry are implemented; HALT cancels local lab audio.
    """
    headers={'Authorization':'Bearer '+token}
    base=server.rstrip('/')
    req=Request(base+'/api/radio-agent/agent/mchs-execution-command',
                headers=headers)
    with urlopen(req,timeout=3) as response:
        state=json.load(response)
    if state.get('version')!=1:
        raise ValueError('MCHS_EXECUTION_PROTOCOL_MISMATCH')
    command=state.get('command')
    if command is not None:
        # STOP always takes precedence. Never treat this as verified PA silence.
        if command.get('action')=='STOP' and isinstance(command.get('eventId'),str):
            # Expired or replayed network commands cannot change local state.
            from mchs_event_commands import validate_command
            with MCHS_EXECUTION_RECEIPT_LOCK:
                accepted, reason=validate_command(command,
                    last_sequence=MCHS_EXECUTION_LAST_STATUS['lastStopSequence'],halted=True)
                if accepted:
                    MCHS_EXECUTION_LAST_STATUS['pendingStop']=dict(command)
            if accepted:
                if alarm_session is not None:
                    alarm_session.stop()
                MCHS_AUDIO_STOP.set()
                MCHS_AUDIO_START.clear()
                MCHS_AUDIO_ARMED.clear()
                MCHS_LAB_ONE_SHOT.clear()
                print('MCHS_EXECUTION_STOP_REQUESTED',command['eventId'],flush=True)
            elif reason!='INVALID_OR_REPLAYED_COMMAND':
                print('MCHS_EXECUTION_STOP_REJECTED',reason,flush=True)
        elif command.get('action')=='START':
            # Verify that the central server explicitly authorized execution
            # before even downloading. Hash validation alone never authorizes
            # playback, and no automatic VLC launch occurs in this branch.
            if state.get('halted') is not False or state.get('executionEnabled') is not True:
                print('MCHS_EXECUTION_START_REJECTED_HOLD',flush=True)
            else:
                from mchs_event_commands import validate_command
                from mchs_alarm_download import cache_verified_alarm
                with MCHS_EXECUTION_RECEIPT_LOCK:
                    last_sequence=MCHS_EXECUTION_LAST_STATUS['lastStopSequence']
                accepted, reason=validate_command(command,
                    last_sequence=last_sequence,halted=False)
                if not accepted:
                    print('MCHS_EXECUTION_START_REJECTED',reason,flush=True)
                else:
                    # Default Agent is deliberately NOT authorized for alarm audio.
                    # Do not download an asset destined for an isolated session
                    # that was never locally armed by the operator.
                    if alarm_session is None or alarm_session.isolation_verified is not True:
                        print('MCHS_EXECUTION_START_BLOCKED_NO_LOCAL_ISOLATION',flush=True)
                        return state
                    cache_root=Path(os.environ.get('RADIO_AGENT_DATA_DIR','radio-agent-data'))/'mchs-alarm-cache'
                    verified_file,reason=cache_verified_alarm(command,cache_root,server,token)
                    if reason is not None:
                        print('MCHS_EXECUTION_START_ASSET_REJECTED',reason,flush=True)
                    elif alarm_session is None:
                        print('MCHS_EXECUTION_START_REJECTED_NO_ISOLATED_SESSION',flush=True)
                    elif MCHS_AUDIO_STOP.is_set() or STOP.is_set():
                        # A STOP may arrive while the ALARM download is in flight.
                        print('MCHS_EXECUTION_START_REJECTED_STOP_RACE',flush=True)
                    else:
                        # Fetch the latest HALT after the potentially slow download.
                        # The original pre-download server snapshot is not a
                        # durable permission to launch a new local process.
                        try:
                            fresh_req=Request(base+'/api/radio-agent/agent/mchs-dispatch-halt',
                                headers={'Authorization':'Bearer '+token})
                            with urlopen(fresh_req,timeout=3) as fresh_response:
                                fresh_halt=json.load(fresh_response)
                        except (HTTPError,URLError,OSError,ValueError):
                            fresh_halt={'halted':True}
                        if fresh_halt.get('halted') is not False or fresh_halt.get('executionEnabled') is not True:
                            print('MCHS_EXECUTION_START_REJECTED_POST_DOWNLOAD_HALT',flush=True)
                            return state
                        outcome=alarm_session.start(
                            event_id=command['eventId'],file=verified_file,
                            repeats=command['repeats'],
                            authorized=(state.get('executionEnabled') is True
                                        and state.get('halted') is False))
                        print('MCHS_EXECUTION_START_SESSION',
                              json.dumps(outcome),flush=True)
        else:
            print('MCHS_EXECUTION_COMMAND_REJECTED_UNSUPPORTED',flush=True)
    if state.get('halted') is True:
        if alarm_session is not None:
            alarm_session.stop()
        epoch=state.get('haltEpoch')
        if isinstance(epoch,str) and epoch:
            if (MCHS_AUDIO_ARMED.is_set() or MCHS_AUDIO_START.is_set() or
                    PLAYBACK_STATE.get('mode')=='MCHS_LAB_TRIAL'):
                MCHS_AUDIO_STOP.set()
                MCHS_AUDIO_START.clear()
                MCHS_AUDIO_ARMED.clear()
                MCHS_LAB_ONE_SHOT.clear()
            MCHS_EXECUTION_LAST_STATUS['haltEpoch']=epoch
    if alarm_session is not None:
        try:
            report_mchs_playback_session(server,token,alarm_session)
        except (HTTPError,URLError,OSError,ValueError):
            print('MCHS_SESSION_STATUS_REPORT_UNAVAILABLE',flush=True)
    return state


def poll_mchs_event_admission(server,token,ledger):
    """Only authenticated event metadata. Never calls VLC or the asset API."""
    headers={'Authorization':'Bearer '+token}
    request=Request(server.rstrip('/')+'/api/radio-agent/agent/mchs-execution-command',
                    headers=headers)
    with urlopen(request,timeout=3) as response:
        state=json.load(response)
    if state.get('version')!=1:
        raise ValueError('MCHS_EXECUTION_PROTOCOL_MISMATCH')
    command=state.get('command')
    if command is None:
        return None
    outcome=ledger.observe(
        command,halted=state.get('halted') is not False,
        execution_enabled=state.get('executionEnabled') is True,
        physical_isolation=True)
    print('MCHS_EVENT_ADMISSION',json.dumps(outcome,ensure_ascii=False),flush=True)
    return outcome


MCHS_EVENT_RECEIPT_LAST = {'id': None}

def acknowledge_mchs_observed_event(server, token):
    """Confirm receipt of real event metadata only; never start audio."""
    base=server.rstrip('/')
    headers={'Authorization':'Bearer '+token}
    with urlopen(Request(base+'/api/radio-agent/agent/mchs-event-observation',
                         headers=headers),timeout=3) as response:
        state=json.load(response)
    event_id=state.get('eventId')
    event_type=state.get('eventType')
    if state.get('observationOnly') is not True or not isinstance(event_id,str) or not event_id:
        return
    if event_type not in ('MISSILE_DANGER','MISSILE_ALL_CLEAR') or MCHS_EVENT_RECEIPT_LAST['id']==event_id:
        return
    payload=json.dumps({'eventId':event_id,'eventType':event_type}).encode('utf-8')
    req=Request(base+'/api/radio-agent/agent/mchs-event-observation-received',
                data=payload,headers={**headers,'Content-Type':'application/json'},method='POST')
    with urlopen(req,timeout=3) as response:
        if response.status==200:
            MCHS_EVENT_RECEIPT_LAST['id']=event_id
            print('MCHS_AGENT_EVENT_METADATA_RECEIVED_ONLY',flush=True)


def get_probe(server, token):
    request=Request(server.rstrip('/')+'/api/radio-agent/agent/stream',
                    headers={'Authorization':'Bearer '+token})
    with urlopen(request,timeout=7) as response:
        if response.status!=200 or 'audio/' not in response.headers.get('Content-Type',''):
            return False
        return len(response.read(2048))>=1024


class Relay(ThreadingHTTPServer):
    daemon_threads=True
    def __init__(self, server, token):
        self.server_url=server.rstrip('/')
        self.token=token
        self.last_data=0.0
        self.packet_count=0
        self.failed=threading.Event()
        self.intentional_disconnect=threading.Event()
        super().__init__(('127.0.0.1',0),RelayHandler)


class RelayHandler(BaseHTTPRequestHandler):
    def log_message(self,*_args):
        pass

    def do_GET(self):
        if self.path!='/listen':
            self.send_error(404)
            return
        request=Request(self.server.server_url+'/api/radio-agent/agent/stream',
                        headers={'Authorization':'Bearer '+self.server.token})
        try:
            with urlopen(request,timeout=5) as upstream:
                if upstream.status!=200 or 'audio/' not in upstream.headers.get('Content-Type',''):
                    raise RuntimeError('Unexpected upstream stream')
                self.send_response(200)
                self.send_header('Content-Type','audio/mpeg')
                self.send_header('Cache-Control','no-store')
                self.end_headers()
                while not STOP.is_set():
                    block=upstream.read(8192)
                    if not block:
                        break
                    self.wfile.write(block)
                    self.server.last_data=time.monotonic()
                    self.server.packet_count+=1
        except (OSError,HTTPError,URLError,RuntimeError) as error:
            if self.server.intentional_disconnect.is_set() or STOP.is_set():
                print('RELAY_CLOSED_FOR_HANDOVER',flush=True)
            else:
                print('RELAY_FAILED',type(error).__name__,flush=True)
        finally:
            if not self.server.intentional_disconnect.is_set():
                self.server.failed.set()


def start_vlc(executable, log, *args):
    with open(log,'ab',buffering=0) as stderr:
        return subprocess.Popen([str(executable),'--intf','dummy','--no-video',
                                 '--no-one-instance','--play-and-exit',*args],
                                stdout=subprocess.DEVNULL,stderr=stderr)


def stop_vlc(proc):
    if proc is not None and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=3)


def read_snapshot(file):
    try:
        data=json.loads(file.read_text(encoding='utf-8'))
        if isinstance(data.get('slots'),list) and isinstance(data.get('autoDj'),dict):
            return data
    except (OSError,ValueError,AttributeError):
        pass
    return None


def run(args, token):
    base=Path(args.data_dir).resolve()
    base.mkdir(parents=True,exist_ok=True)
    cache=base/'cache'
    logfile=base/'windows-central-vlc.log'
    snapshotfile=base/'snapshot.json'
    # Never begin playback without confirmed authorization. Transient network
    # timeouts must not terminate the GUI; retry until reachable or user stops.
    attempt=0
    while not STOP.is_set():
        try:
            if not permitted(get_status(args.server,token)):
                raise PermissionError('Server does not permit playback')
            break
        except HTTPError as error:
            if error.code in (401,403):
                raise PermissionError('Device token rejected or playback forbidden') from None
            attempt+=1
            print('SERVER_CONNECT_RETRY',type(error).__name__,flush=True)
        except PermissionError:
            # PermissionError inherits OSError; never treat explicit server denial as transient.
            raise
        except (TimeoutError,OSError,URLError) as error:
            attempt+=1
            print('SERVER_CONNECT_RETRY',type(error).__name__,flush=True)
        STOP.wait(min(15,2*attempt))
    if STOP.is_set():
        return
    snapshot=read_snapshot(snapshotfile)
    last_authorized=time.monotonic()
    PLAYBACK_STATE.update(mode='STOPPED',lastAuthorized=last_authorized,offlineGrace=args.offline_grace,streamLastSeen=0.0,broadcastRunning=True)
    relay=Relay(args.server,token)
    threading.Thread(target=relay.serve_forever,daemon=True).start()
    primary=None
    fallback=None
    fallback_key=None
    fallback_deadline=0.0
    last_primary_data=0.0
    last_probe=0.0
    next_sync=0.0
    result_lock=threading.Lock()
    results=[]
    sync_running=threading.Event()
    probe_running=threading.Event()
    network_ok=False
    denied=False
    esp32_host=getattr(args,'esp32_host',os.environ.get('RADIO_ESP32_IP','')).strip()
    esp32_secret=getattr(args,'esp32_secret',os.environ.get('RADIO_ESP32_SECRET','')).strip()
    last_esp32=0.0
    last_audio_report=0.0
    last_mchs_observer_poll=0.0
    mchs_observer_busy=threading.Event()
    last_mchs_observed_revision=None
    mchs_transition_shadow=MchsTransitionShadow()
    mchs_lab_chain_transition=LabChainTransition()
    # Only the explicitly started headphones pilot can create this session.
    # A server command cannot declare the physical output isolated.
    alarm_session=AlarmPlaybackSession(
        lambda file:start_vlc(args.vlc,logfile,str(file)),
        heartbeat=lambda:(
            not STOP.is_set() and
            PLAYBACK_STATE.get('lastAuthorized',0)>0 and
            time.monotonic()-PLAYBACK_STATE.get('lastAuthorized',0)<15),
        isolation_verified=False)
    trial_vlc=None
    trial_relay=None
    trial_started_at=0.0
    central_return_monitor=CentralReturnMonitor()
    local_cycle=None
    local_cycle_session=None
    event_ledger=(EventAdmissionLedger(base/'mchs-event-admission.json')
                  if (getattr(args,'isolated_event_admission',False) or
                      getattr(args,'isolated_event_audio',False)) else None)
    event_audio=None
    event_audio_session=None
    last_event_audio_poll=0.0
    pending_relay_audio=None
    PLAYBACK_STATE.update(mchsRelayPrepareEventId=None,mchsRelayAckEventId=None,
                          mchsRelayFirstAckAt=None,mchsRelayLastAckAt=None)
    last_isolated_ready_report=0.0
    isolated_ready_report_busy=threading.Event()
    last_event_receipt_retry=0.0
    pending_event_receipts=[]
    reported_event_receipts=set()
    if getattr(args,'isolated_event_audio',False):
        event_audio=IsolatedEventAudioController(event_ledger,args.isolated_event_assets)
        event_audio_session=AlarmPlaybackSession(
            lambda file:start_vlc(args.vlc,logfile,str(file)),
            heartbeat=lambda:(not STOP.is_set() and
                time.monotonic()-PLAYBACK_STATE.get('lastAuthorized',0)<15),
            isolation_verified=True)
        print('MCHS_EVENT_BOUND_HEADPHONES_ONLY',flush=True)
    cycle_assets=getattr(args,'isolated_cycle_assets',None)
    if cycle_assets is not None:
        danger,clear=cycle_assets
        local_cycle=IntegratedHeadphonesCycle(
            danger_repeats=args.isolated_cycle_repeats,
            danger_duration=danger['duration'],
            clear_duration=clear['duration'])
        local_cycle_session=AlarmPlaybackSession(
            lambda file:start_vlc(args.vlc,logfile,str(file)),
            heartbeat=lambda:(not STOP.is_set() and
                time.monotonic()-PLAYBACK_STATE.get('lastAuthorized',0)<15),
            isolation_verified=True)
        print('MCHS_INTEGRATED_HEADPHONES_LOCAL_ONLY',flush=True)
    output_probe={'state':'UNKNOWN','name':None,'count':None}
    last_output_probe=0.0
    output_probe_busy=threading.Event()

    def probe_output():
        nonlocal output_probe
        try:
            output_probe=inspect_outputs()
        finally:
            output_probe_busy.clear()

    def refresh():
        try:
            fresh=sync(args.server,token,base)
            with result_lock:
                results.append(fresh)
        except (OSError,ValueError,KeyError,RuntimeError) as error:
            print('SYNC_FAILED',type(error).__name__,flush=True)
        finally:
            sync_running.clear()

    def probe():
        nonlocal network_ok,denied,last_authorized
        try:
            status=get_status(args.server,token)
            if not permitted(status):
                denied=True
                return
            last_authorized=time.monotonic()
            PLAYBACK_STATE['lastAuthorized']=last_authorized
            network_ok=get_probe(args.server,token)
        except HTTPError as error:
            if error.code in (401,403):
                denied=True
            network_ok=False
        except (OSError,ValueError,RuntimeError):
            network_ok=False
        finally:
            probe_running.clear()

    def check_mchs_observer():
        nonlocal last_mchs_observed_revision
        try:
            data=read_mchs_observer(args.server,token)
            revision=data.get('revision')
            if data.get('mode')!='OBSERVE_ONLY' or not isinstance(revision,int) or isinstance(revision,bool):
                print('MCHS_LAB_OBSERVER_INVALID',str(data.get('mode')),str(data.get('workerPhase')),type(revision).__name__,flush=True)
                return
            with MCHS_LAB_ONE_SHOT_LOCK:
                MCHS_LAB_OBSERVED.update(phase=data.get('workerPhase'),revision=revision,
                                         at=time.monotonic(),ready=True)
            moment=time.monotonic()
            primary_alive=primary is not None and primary.poll() is None
            reserve_alive=fallback is not None and fallback.poll() is None
            age_ms=(moment-relay.last_data)*1000 if relay.last_data else None
            ready=assess_mchs_readiness(
                primary_alive=primary_alive,reserve_alive=reserve_alive,
                last_packet_age_ms=age_ms,output_state=output_probe.get('state','UNKNOWN'),
                authorized=not denied and moment-last_authorized<=args.offline_grace,
                worker_phase=data.get('workerPhase'))
            preflight=evaluate_isolated_output_preflight(
                observer=ready,pa_cable_disconnected=False,
                separate_output_confirmed=False,operator_present=False)
            with MCHS_LAB_ONE_SHOT_LOCK:
                last_observed_at=MCHS_LAB_OBSERVED['at']
            with_state=trial_relay if trial_relay is not None else None
            if with_state is not None:
                with with_state.metrics_lock:
                    lab_connected=with_state.connected_at is not None
                    last_pcm_at=with_state.last_pcm_at
            else:
                lab_connected=False
                last_pcm_at=None
            chain=assess_lab_chain(
                observer_fresh=last_observed_at>0 and moment-last_observed_at<10,
                worker_phase=data.get('workerPhase'),
                authorized=not denied and moment-last_authorized<=args.offline_grace,
                primary_alive=primary_alive,reserve_alive=reserve_alive,
                output_state=output_probe.get('state','UNKNOWN'),
                lab_connected=lab_connected,
                pcm_age_seconds=moment-last_pcm_at if last_pcm_at is not None else None,
                trial_active=trial_vlc is not None)
            chain_event=mchs_lab_chain_transition.observe(chain)
            if chain_event is not None:
                print('MCHS_LAB_CHAIN_CHANGE',json.dumps(chain_event),flush=True)
            transition=mchs_transition_shadow.observe(revision,data.get('workerPhase'))
            report={'revision':revision,**ready,'preflight':preflight,
                    'transition':transition}
            if transition is not None:
                if should_stop_auto_lab(transition,auto_active=MCHS_LAB_AUTO_ACTIVE.is_set()):
                    MCHS_LAB_AUTO_ACTIVE.clear()
                    MCHS_AUDIO_ARMED.clear()
                    MCHS_AUDIO_STOP.set()
                    print('MCHS_LAB_AUTO_STOP_ON_RESUME',revision,data.get('workerPhase'),flush=True)
                with MCHS_LAB_ONE_SHOT_LOCK:
                    should_trigger=next_lab_trigger(
                        transition,armed=MCHS_LAB_ONE_SHOT.is_set(),
                        expires_at=MCHS_LAB_ONE_SHOT_EXPIRES['at'],now=moment)
                    if should_trigger:
                        MCHS_LAB_ONE_SHOT.clear()  # exactly once, before dispatch
                if should_trigger and not MCHS_AUDIO_ARMED.is_set() and not MCHS_AUDIO_START.is_set() and not STOP.is_set():
                    MCHS_AUDIO_STOP.clear()
                    MCHS_AUDIO_ARMED.set()
                    MCHS_LAB_AUTO_ACTIVE.set()
                    MCHS_AUTO_LAB_EXPECTED_REVISION['value']=revision
                    MCHS_AUDIO_START.set()
                    print('MCHS_LAB_ONE_SHOT_TRIGGERED',revision,flush=True)
                last_mchs_observed_revision=revision
                print('MCHS_AGENT_OBSERVER',json.dumps({
                    **report,'stationPlaybackChanged':False,'paOutputChanged':False}),flush=True)
            # Heartbeats refresh dashboard freshness even if revision is unchanged.
            # No audio, power or ESP32 action is performed by the observer.
            try:
                send_mchs_observer_report(args.server,token,report)
            except (OSError,ValueError):
                print('MCHS_AGENT_OBSERVER_REPORT_UNAVAILABLE',flush=True)
        except HTTPError as error:
            if error.code != 403:
                print('MCHS_AGENT_OBSERVER_UNAVAILABLE',error.code,flush=True)
        except (OSError,ValueError,KeyError):
            print('MCHS_AGENT_OBSERVER_UNAVAILABLE',flush=True)
        finally:
            mchs_observer_busy.clear()

    def report_trial_vlc_state(state, process_running):
        try:
            send_mchs_trial_vlc_state(args.server,token,state,process_running)
        except (OSError,ValueError):
            print('MCHS_TRIAL_VLC_STATE_REPORT_UNAVAILABLE',flush=True)

    def report_trial_stop(evidence):
        try:
            send_mchs_trial_process_stop(args.server,token,evidence)
        except (OSError,ValueError):
            print('MCHS_TRIAL_PROCESS_STOP_REPORT_UNAVAILABLE',flush=True)

    # HALT receipt polling must not depend on the MCHS lab observer.
    halt_poll_busy=threading.Event()
    last_halt_poll=0.0
    def check_halt_receipt():
        try:
            acknowledge_mchs_halt(args.server,token)
        except HTTPError as error:
            if error.code not in (403,409):
                print('MCHS_DISPATCH_HALT_RECEIPT_UNAVAILABLE',flush=True)
        except (OSError,ValueError):
            print('MCHS_DISPATCH_HALT_RECEIPT_UNAVAILABLE',flush=True)
        finally:
            halt_poll_busy.clear()

    execution_command_busy=threading.Event()
    last_execution_command_poll=[0.0]
    event_observation_busy=threading.Event()
    last_event_observation_poll=[0.0]
    def launch_event_audio(detail,now):
        nonlocal primary,fallback,fallback_key,network_ok,last_probe
        # Recheck the on-disk WAV immediately before START.
        # The operator-selected file may have been replaced
        # after startup validation, and an event cannot
        # authorize new bytes by path alone.
        try:
            current=verify_local_training_wav(detail['asset'])
            asset_unchanged=(current['sha256']==detail['sha256'])
        except (OSError,ValueError):
            asset_unchanged=False
        if not asset_unchanged:
            event_audio.started(False,now=now,duration=0)
            print('MCHS_EVENT_AUDIO_LOCAL_ASSET_CHANGED',
                  detail['eventId'],flush=True)
        else:
            # Only the Agent-owned VLC decks are stopped.
            relay.intentional_disconnect.set()
            stop_vlc(primary)
            stop_vlc(fallback)
            primary=None
            fallback=None
            fallback_key=None
            relay.failed.set()
            started=event_audio_session.start(
                event_id=detail['eventId'],
                file=detail['asset'],repeats=detail['repeats'],
                authorized=True)
            event_audio.started(
                started['accepted'],now=now,
                duration=current['duration'])
            PLAYBACK_STATE['mchsIsolatedEventId']=(detail['eventId'] if started['accepted'] else None)
            network_ok=False
            last_probe=0.0
            print('MCHS_EVENT_AUDIO_START',
                  detail['eventId'],json.dumps(started),flush=True)

    print('WINDOWS HEADPHONES PILOT; NO AMP/ESP32. Stop with Ctrl+C.',flush=True)
    try:
        while not STOP.is_set():
            now=time.monotonic()
            if now-last_halt_poll>=3 and not halt_poll_busy.is_set():
                last_halt_poll=now
                halt_poll_busy.set()
                threading.Thread(target=check_halt_receipt,daemon=True).start()
            if local_cycle is None and event_audio is None and now-last_execution_command_poll[0]>=3 and not execution_command_busy.is_set():
                last_execution_command_poll[0]=now
                execution_command_busy.set()
                def check_execution_command():
                    try:
                        if event_ledger is not None:
                            poll_mchs_event_admission(args.server,token,event_ledger)
                        else:
                            poll_mchs_execution_command(args.server,token,alarm_session)
                    except (HTTPError,OSError,ValueError):
                        print('MCHS_EXECUTION_COMMAND_CHANNEL_UNAVAILABLE',flush=True)
                    finally:
                        execution_command_busy.clear()
                threading.Thread(target=check_execution_command,daemon=True).start()
            if local_cycle is None and event_audio is None and now-last_event_observation_poll[0]>=3 and not event_observation_busy.is_set():
                last_event_observation_poll[0]=now
                event_observation_busy.set()
                def check_event_observation():
                    try:
                        acknowledge_mchs_observed_event(args.server,token)
                    except (HTTPError,OSError,ValueError):
                        pass
                    finally:
                        event_observation_busy.clear()
                threading.Thread(target=check_event_observation,daemon=True).start()
            # Playback health is independent from a power-intent HTTP request.
            primary_alive=primary is not None and primary.poll() is None
            reserve_alive=fallback is not None and fallback.poll() is None
            return_result=central_return_monitor.observe(
                now=now,packet_count=relay.packet_count,
                last_packet_at=relay.last_data,primary_alive=primary_alive,
                relay_failed=relay.failed.is_set(),reserve_alive=reserve_alive)
            if return_result and return_result['status'] in ('CONFIRMED','UNCONFIRMED'):
                print('MCHS_CENTRAL_RETURN_'+return_result['status'],
                      return_result.get('reason','FRESH_CENTRAL_PACKETS'),flush=True)
            active_audio=(primary_alive and
                          not relay.failed.is_set() and now-relay.last_data<=4)
            reserve_audio=fallback is not None and fallback.poll() is None
            PLAYBACK_STATE['mode']='CENTRAL' if active_audio else 'LOCAL_RESERVE' if reserve_audio else 'STOPPED'
            if active_audio or reserve_audio:
                PLAYBACK_STATE['streamLastSeen']=now
            if now-last_output_probe>=30 and not output_probe_busy.is_set():
                last_output_probe=now
                output_probe_busy.set()
                threading.Thread(target=probe_output,daemon=True).start()
            if local_cycle is None and event_audio is None and now-last_mchs_observer_poll>=3 and not mchs_observer_busy.is_set():
                last_mchs_observer_poll=now
                mchs_observer_busy.set()
                threading.Thread(target=check_mchs_observer,daemon=True).start()
            if now-last_audio_report>=8:
                last_audio_report=now
                report=playback_report(primary,fallback,relay,now)
                report['outputEndpoint']=dict(output_probe)
                threading.Thread(target=async_playback_report,
                                 args=(args.server,token,report),daemon=True).start()
            if esp32_host and esp32_secret and now-last_esp32>=3:
                last_esp32=now
                # Safe pilot telemetry only. No relay actuation is possible.
                active=primary is not None and primary.poll() is None
                reserve=fallback is not None and fallback.poll() is None
                mode='CENTRAL' if active else 'LOCAL_RESERVE' if reserve else 'STOPPED'
                PLAYBACK_STATE['mode']=mode
                try:
                    send_heartbeat(esp32_host,esp32_secret,mode,active or reserve,
                        not denied and now-last_authorized<=args.offline_grace)
                except Exception as error:
                    print('ESP32_HEARTBEAT_FAILED',type(error).__name__,flush=True)
            with result_lock:
                if results:
                    snapshot=results[-1]
                    results.clear()
            # Fail closed if laboratory observer stops reporting fresh state.
            with MCHS_LAB_ONE_SHOT_LOCK:
                failsafe=observer_failsafe(
                    now=now,last_seen_at=MCHS_LAB_OBSERVED['at'],
                    automatic_trial_active=MCHS_LAB_AUTO_ACTIVE.is_set(),
                    one_shot_armed=MCHS_LAB_ONE_SHOT.is_set(),
                    expires_at=MCHS_LAB_ONE_SHOT_EXPIRES['at'])
                if failsafe['cancel_arm']:
                    MCHS_LAB_ONE_SHOT.clear()
                    print('MCHS_LAB_ONE_SHOT_CANCELLED',
                          'OBSERVER_STALE' if failsafe['observer_stale'] else 'ARM_EXPIRED',
                          flush=True)
            if failsafe['stop_trial']:
                MCHS_LAB_AUTO_ACTIVE.clear()
                MCHS_AUDIO_ARMED.clear()
                MCHS_AUDIO_STOP.set()
                print('MCHS_LAB_AUTO_STOP_OBSERVER_STALE',flush=True)

            # Event-bound rehearsal is a separate, explicitly operator-armed
            # HEADPHONES mode. Existing START/STOP handlers never launch it.
            if event_audio is not None:
                fresh_central=(primary is not None and primary.poll() is None
                    and not relay.failed.is_set() and
                    relay.packet_count>0 and now-relay.last_data<=4)
                authorized=not denied and now-last_authorized<15
                if (now-last_isolated_ready_report>=15 and
                        not isolated_ready_report_busy.is_set()):
                    last_isolated_ready_report=now
                    isolated_ready_report_busy.set()
                    readiness=make_isolated_readiness(
                        args.isolated_event_assets,
                                                if action=='START_AUDIO':
                            if (getattr(args,'isolated_relay_trial',False) and
                                    SYNTHETIC.fullmatch(detail['eventId'])):
                                pending_relay_audio={'detail':detail,'requestedAt':now}
                                PLAYBACK_STATE.update(
                                    mchsRelayPrepareEventId=detail['eventId'],
                                    mchsRelayAckEventId=None,
                                    mchsRelayFirstAckAt=None,mchsRelayLastAckAt=None)
                                relay.intentional_disconnect.set()
                                stop_vlc(primary)
                                stop_vlc(fallback)
                                primary=None
                                fallback=None
                                fallback_key=None
                                relay.failed.set()
                                print('MCHS_RELAY_PREROLL_ARMED',
                                      detail['eventId'],flush=True)
                            else:
                                launch_event_audio(detail,now)
                        elif action not in ('NO_ACTION','REJECTED'):
                            print('MCHS_EVENT_AUDIO_COMMAND',action,str(detail),flush=True)
                        elif action=='REJECTED' and detail not in ('INVALID_OR_REPLAYED_COMMAND','REPLAYED_EVENT'):
                            print('MCHS_EVENT_AUDIO_REJECTED',detail,flush=True)
                    except (HTTPError,URLError,OSError,ValueError) as error:
                        print('MCHS_EVENT_AUDIO_POLL_UNAVAILABLE',
                              type(error).__name__,flush=True)
                if pending_relay_audio is not None:
                    detail=pending_relay_audio['detail']
                    if event_audio.state!='STARTING':
                        print('MCHS_RELAY_PREROLL_CANCELLED',
                              detail['eventId'],event_audio.state,flush=True)
                        pending_relay_audio=None
                        PLAYBACK_STATE['mchsRelayPrepareEventId']=None
                    else:
                        phase=preroll_decision(
                            event_id=detail['eventId'],
                            requested_at=pending_relay_audio['requestedAt'],
                            now=time.monotonic(),
                            ack_event_id=PLAYBACK_STATE.get('mchsRelayAckEventId'),
                            first_ack_at=PLAYBACK_STATE.get('mchsRelayFirstAckAt'),
                            last_ack_at=PLAYBACK_STATE.get('mchsRelayLastAckAt'),
                            authorized=not denied and
                                time.monotonic()-last_authorized<15,
                            stopped=STOP.is_set())
                        if phase=='READY':
                            # The 3s window begins at signed ON ACK, never at
                            # Android receipt. Keep relay lease renewed while WAV plays.
                            pending_relay_audio=None
                            print('MCHS_RELAY_PREROLL_READY',
                                  detail['eventId'],flush=True)
                            launch_event_audio(detail,time.monotonic())
                            PLAYBACK_STATE['mchsRelayPrepareEventId']=None
                        elif phase in ('TIMEOUT','DENIED','NOT_SYNTHETIC',
                                       'INVALID_REQUEST'):
                            event_audio.started(False,now=time.monotonic(),
                                                duration=0,
                                                failure_reason='RELAY_PREROLL_'+phase)
                            PLAYBACK_STATE['mchsRelayPrepareEventId']=None
                            pending_relay_audio=None
                            print('MCHS_RELAY_PREROLL_FAILED',
                                  detail['eventId'],phase,flush=True)
                transition=event_audio.tick(
                    now=now,authorized=not denied and now-last_authorized<15,
                    session=(event_audio_session.status() if event_audio.playing else None),
                    return_result=return_result)
                if transition in ('RESTORE','STOP_AND_RESTORE'):
                    confirmed=True
                    if transition=='STOP_AND_RESTORE':
                        stopped=event_audio_session.stop()
                        confirmed=stopped.get('stopConfirmed') is True
                        print('MCHS_EVENT_AUDIO_STOP_EVIDENCE',
                              event_audio.event,confirmed,flush=True)
                    if transition=='RESTORE':
                        receipt=event_audio_session.status()
                        confirmed=(receipt['processRunning'] is False and
                                   receipt['naturalCompletion'] is True and
                                   receipt['eventId']==event_audio.event)
                    # Do not resume while a local WAV process is alive.
                    confirmed=confirmed and event_audio_session.status()['processRunning'] is False
                    armed=central_return_monitor.arm(
                        ended_at=time.monotonic(),packet_count=relay.packet_count,
                        trial_exited=confirmed)
                    event_audio.restore_armed(now=now,confirmed=armed)
                    network_ok=False
                    last_probe=0.0
                    print('MCHS_EVENT_AUDIO_RETURN_ARMED',event_audio.event,armed,flush=True)
                elif transition in ('RETURN_CONFIRMED','RETURN_FAILED'):
                    print('MCHS_EVENT_AUDIO_RESULT',
                          json.dumps(event_audio.snapshot(),ensure_ascii=False),flush=True)
                # Observations never govern playback or the Worker. Once per
                # (event,terminal state), queue a local-only receipt. A failed
                # network POST is retried; no unconfirmed status becomes success.
                state_snapshot=event_audio.snapshot()
                event_key=(state_snapshot['eventId'],state_snapshot['state'])
                if (state_snapshot['state'] in ('COMPLETE','FAILED') and
                        state_snapshot['eventId'] and
                        event_key not in reported_event_receipts):
                    report=make_event_observation(
                        event_audio,event_audio_session.status())
                    if report is not None:
                        reported_event_receipts.add(event_key)
                        pending_event_receipts.append(report)
                        if len(pending_event_receipts)>50:
                            pending_event_receipts.pop(0)
                if pending_event_receipts and now-last_event_receipt_retry>=5:
                    last_event_receipt_retry=now
                    receipt=pending_event_receipts[0]
                    try:
                        if post_event_observation(args.server,token,receipt):
                            pending_event_receipts.pop(0)
                            print('MCHS_EVENT_OBSERVATION_ACCEPTED',
                                  receipt['eventId'],receipt['phase'],flush=True)
                    except (HTTPError,URLError,OSError,ValueError) as error:
                        print('MCHS_EVENT_OBSERVATION_RETRY',
                              type(error).__name__,flush=True)
            # One operator-authorized, physically isolated cycle in THIS Agent.
            # Controls only the Agent's VLC children and verified local WAV.
            # It never sends START to Worker or to PA.
            if local_cycle is not None and not local_cycle.terminal:
                active_central=(primary is not None and primary.poll() is None
                    and not relay.failed.is_set()
                    and relay.packet_count>0 and now-relay.last_data<=4)
                conflict=(trial_vlc is not None or MCHS_AUDIO_START.is_set()
                    or MCHS_AUDIO_ARMED.is_set() or MCHS_LAB_AUTO_ACTIVE.is_set())
                instruction=local_cycle.tick(
                    now=now,central_ready=active_central and network_ok,
                    authorized=not denied and now-last_authorized<15,
                    conflicting=conflict,
                    session=(local_cycle_session.status()
                             if local_cycle.playing else None),
                    returned=return_result)
                if instruction in ('START_DANGER','START_ALL_CLEAR'):
                    stage='DANGER' if instruction=='START_DANGER' else 'ALL_CLEAR'
                    audio=cycle_assets[0] if stage=='DANGER' else cycle_assets[1]
                    count=args.isolated_cycle_repeats if stage=='DANGER' else 1
                    # Stop BOTH decks before opening the local training WAV.
                    relay.intentional_disconnect.set()
                    stop_vlc(primary)
                    stop_vlc(fallback)
                    primary=None
                    fallback=None
                    fallback_key=None
                    relay.failed.set()
                    started=local_cycle_session.start(
                        event_id='isolated-central-'+stage.lower()+'-'+str(time.monotonic_ns()),
                        file=audio['path'],repeats=count,authorized=True)
                    local_cycle.started(stage,started.get('accepted') is True,now)
                    print('MCHS_INTEGRATED_'+stage+'_START',
                          'repeats='+str(count),started.get('reason'),flush=True)
                    if not started.get('accepted'):
                        network_ok=False
                        last_probe=0.0
                elif instruction in ('RESTORE_PROGRAM','RESTORE_FAULT'):
                    if instruction=='RESTORE_FAULT':
                        stopped=local_cycle_session.stop()
                        print('MCHS_INTEGRATED_FAULT_STOP',
                              stopped.get('stopConfirmed'),flush=True)
                    # A fresh central packet is needed AFTER each local WAV.
                    network_ok=False
                    last_probe=0.0
                    armed=central_return_monitor.arm(
                        ended_at=time.monotonic(),
                        packet_count=relay.packet_count,
                        trial_exited=(local_cycle_session.status()['processRunning'] is False
                                     and (instruction=='RESTORE_PROGRAM' or
                                          stopped.get('stopConfirmed') is True)))
                    local_cycle.restored(now=now,monitor_armed=armed)
                    print('MCHS_INTEGRATED_RESTORE_REQUESTED',
                          local_cycle.stage,armed,flush=True)
                elif instruction in ('FINISHED','FAULT_RETURNED'):
                    print('MCHS_INTEGRATED_CYCLE_'+
                          ('COMPLETE' if instruction=='FINISHED' else 'FAILED'),
                          'stages='+str(local_cycle.history),flush=True)
                if local_cycle.terminal and local_cycle.failure:
                    print('MCHS_INTEGRATED_CYCLE_FAILED',
                          local_cycle.failure,flush=True)
            # Operator-only local trial on the SAME Windows output, with the PA
            # audio cable physically disconnected. No network action can arm this.
            trial_reason=None
            if trial_vlc is not None:
                with trial_relay.metrics_lock:
                    connected_at=trial_relay.connected_at
                    last_pcm_at=trial_relay.last_pcm_at
                trial_reason=trial_stop_reason(
                    now=now,started_at=trial_started_at,
                    connected_at=connected_at,last_pcm_at=last_pcm_at,
                    stop_requested=MCHS_AUDIO_STOP.is_set(),
                    armed=MCHS_AUDIO_ARMED.is_set(),
                    authorized=not denied and now-last_authorized<=15,
                    vlc_running=trial_vlc.poll() is None)
            if trial_reason is not None or MCHS_AUDIO_STOP.is_set():
                if trial_reason:
                    print('MCHS_AUDIO_TRIAL_STOP_REASON',trial_reason,flush=True)
                requested_stop=MCHS_AUDIO_STOP.is_set()
                MCHS_AUDIO_STOP.clear()
                lab_end_evidence=None
                if trial_vlc is not None and trial_relay is not None:
                    with trial_relay.metrics_lock:
                        eof_at=trial_relay.stream_eof_at
                        forwarded=trial_relay.bytes_forwarded
                        stream_failed=trial_relay.stream_failed
                        stream_capped=trial_relay.stream_capped
                    lab_end_evidence=assess_lab_trial_end(
                        stop_reason=trial_reason,
                        vlc_exit_code=trial_vlc.poll(),pcm_eof_at=eof_at,
                        bytes_forwarded=forwarded,stream_failed=stream_failed,
                        capped=stream_capped,stopped_by_operator=requested_stop)
                    print('MCHS_LAB_PCM_END_EVIDENCE',
                          lab_end_evidence['classification'],flush=True)
                if trial_relay is not None:
                    trial_relay.closing.set()
                stopped_process=trial_vlc
                stop_vlc(stopped_process)
                # A stop request is not a verified stop until the child has exited.
                # Keep the evidence scoped to this isolated trial VLC process.
                trial_vlc=None
                relay_closed=False
                if trial_relay is not None:
                    trial_relay.shutdown()
                    trial_relay.server_close()
                    trial_relay=None
                    relay_closed=True
                if stopped_process is not None:
                    evidence={'mode':'LAB_PROCESS_ONLY','kind':'TRIAL_VLC_STOP',
                              **trial_stop_evidence(stopped_process,relay_closed),
                              'reason':'OPERATOR_STOP' if requested_stop else (
                                  'PCM_EOF_OBSERVED' if lab_end_evidence and
                                  lab_end_evidence['naturalPcmEndObserved'] else 'WATCHDOG')}
                    threading.Thread(target=report_trial_stop,args=(evidence,),daemon=True).start()
                    if evidence['stopConfirmed']:
                        threading.Thread(target=report_trial_vlc_state,
                                         args=('STOPPED',False),daemon=True).start()
                MCHS_LAB_AUTO_ACTIVE.clear()
                MCHS_AUDIO_ARMED.clear()
                MCHS_AUDIO_START.clear()
                network_ok=False  # trigger fresh normal stream probe/reconnect
                last_probe=0.0
                if stopped_process is not None and stopped_process.poll() is not None:
                    if central_return_monitor.arm(
                            ended_at=time.monotonic(),packet_count=relay.packet_count,
                            trial_exited=True):
                        print('MCHS_CENTRAL_RETURN_MONITOR_ARMED',flush=True)
                print('MCHS_AUDIO_TRIAL_STOPPED_RETURN_TO_PROGRAM',flush=True)
            # Report actual process exit, not merely receipt of a STOP request.
            # Failed acknowledgements are retried on the next main-loop iteration.
            with MCHS_EXECUTION_RECEIPT_LOCK:
                pending_stop=MCHS_EXECUTION_LAST_STATUS['pendingStop']
            if pending_stop and can_confirm_local_stop(trial_vlc,MCHS_AUDIO_START.is_set(),alarm_session):
                try:
                    if send_mchs_device_stop_receipt(args.server,token,pending_stop):
                        with MCHS_EXECUTION_RECEIPT_LOCK:
                            if MCHS_EXECUTION_LAST_STATUS['pendingStop'] is pending_stop:
                                MCHS_EXECUTION_LAST_STATUS['lastStopSequence']=pending_stop['sequence']
                                MCHS_EXECUTION_LAST_STATUS['pendingStop']=None
                        print('MCHS_DEVICE_STOP_RECEIPT_CONFIRMED',pending_stop['eventId'],flush=True)
                except (HTTPError,OSError,ValueError):
                    print('MCHS_DEVICE_STOP_RECEIPT_RETRY',flush=True)
            if MCHS_AUDIO_START.is_set():
                MCHS_AUDIO_START.clear()
                if MCHS_LAB_AUTO_ACTIVE.is_set():
                    with MCHS_LAB_ONE_SHOT_LOCK:
                        observed=dict(MCHS_LAB_OBSERVED)
                    if not queued_auto_trial_current(
                            observed,MCHS_AUTO_LAB_EXPECTED_REVISION['value'],now):
                        MCHS_LAB_AUTO_ACTIVE.clear()
                        MCHS_AUTO_LAB_EXPECTED_REVISION['value']=None
                        MCHS_AUDIO_ARMED.clear()
                        print('MCHS_AUTO_LAB_STALE_TRIGGER_REJECTED',flush=True)
                        continue
                if trial_vlc is None and MCHS_AUDIO_ARMED.is_set() and not denied and network_ok and now-last_authorized<15:
                    try:
                        # Close both audible decks before opening the training audio.
                        relay.intentional_disconnect.set()
                        stop_vlc(primary)
                        stop_vlc(fallback)
                        primary=None
                        fallback=None
                        fallback_key=None
                        relay.failed.set()
                        trial_relay=LocalMonitor(args.server,token)
                        threading.Thread(target=trial_relay.serve_forever,daemon=True).start()
                        lab_url='http://127.0.0.1:%d/lab.wav'%trial_relay.server_address[1]
                        trial_vlc=start_vlc(args.vlc,logfile,'--network-caching=120',lab_url)
                        trial_started_at=now
                        if trial_vlc is not None and trial_vlc.poll() is None:
                            threading.Thread(target=report_trial_vlc_state,
                                             args=('STARTED',True),daemon=True).start()
                        print('MCHS_AUDIO_TRIAL_STARTED_MAX_30_SECONDS',flush=True)
                    except (OSError,ValueError):
                        MCHS_AUDIO_STOP.set()
                        print('MCHS_AUDIO_TRIAL_FAILED',flush=True)
                else:
                    MCHS_AUDIO_ARMED.clear()
                    print('MCHS_AUDIO_TRIAL_REJECTED',flush=True)
            if trial_vlc is not None:
                PLAYBACK_STATE['mode']='MCHS_LAB_TRIAL'
                STOP.wait(0.2)
                continue
            if denied:
                print('PLAYBACK_PERMISSION_DENIED',flush=True)
                break
            # Keep the operator-started agent alive during a multi-hour outage.
            # Expired authorization must stop *both* audible decks, not the
            # reconnect loop. Probe will reauthorize after the network returns.
            if now-last_authorized>args.offline_grace:
                if primary is not None or fallback is not None:
                    stop_vlc(primary)
                    stop_vlc(fallback)
                    primary=None
                    fallback=None
                    fallback_key=None
                    relay.failed.set()
                    print('PLAYBACK_PERMISSION_EXPIRED_WAITING_FOR_NETWORK',flush=True)
                network_ok=False
                PLAYBACK_STATE['mode']='STOPPED'
                if now>=last_probe and not probe_running.is_set():
                    probe_running.set()
                    threading.Thread(target=probe,daemon=True).start()
                    last_probe=now+5
                STOP.wait(0.5)
                continue
            if now>=last_probe and not probe_running.is_set():
                probe_running.set()
                threading.Thread(target=probe,daemon=True).start()
                last_probe=now+5
            if network_ok and now>=next_sync and not sync_running.is_set():
                sync_running.set()
                threading.Thread(target=refresh,daemon=True).start()
                next_sync=now+60
            if local_cycle is not None and local_cycle.playing:
                PLAYBACK_STATE['mode']='MCHS_ISOLATED_LOCAL_WAV'
                STOP.wait(0.2)
                continue
            # Expose only the current locally admitted event to the GUI's
            # supervised relay pilot. Clear it at every nonplaying boundary.
            PLAYBACK_STATE['mchsIsolatedEventId']=(event_audio.event
                if event_audio is not None and event_audio.playing else None)
            if pending_relay_audio is not None:
                # Keep central audio muted throughout warm-up; do not
                # reconnect the VLC deck until ALARM or terminal failure.
                PLAYBACK_STATE['mode']='MCHS_RELAY_PRE_ROLL'
                STOP.wait(0.2)
                continue
            if event_audio is not None and event_audio.playing:
                PLAYBACK_STATE['mode']='MCHS_EVENT_ISOLATED_LOCAL_WAV'
                STOP.wait(0.2)
                continue
            if (event_audio is not None and event_audio.failure=='LOCAL_AUDIO_STOP_UNCONFIRMED'):
                # An unconfirmed VLC termination cannot overlap a new deck.
                PLAYBACK_STATE['mode']='STOPPED'
                STOP.wait(0.2)
                continue
            if primary is None and network_ok:
                # Stop local reserve before starting primary to avoid overlapping audio.
                stop_vlc(fallback)
                fallback=None
                fallback_key=None
                relay.failed.clear()
                relay.intentional_disconnect.clear()
                relay.last_data=time.monotonic()
                url='http://127.0.0.1:%d/listen'%relay.server_address[1]
                primary=start_vlc(args.vlc,logfile,'--network-caching=300',url)
                last_primary_data=relay.last_data
                print('PRIMARY_CONNECTING',flush=True)
            if primary is not None:
                if primary.poll() is not None or relay.failed.is_set() or (time.monotonic()-relay.last_data>4):
                    stop_vlc(primary)
                    primary=None
                    network_ok=False
                    print('LOCAL_STANDBY',flush=True)
            if primary is None:
                selection=standby_selection(snapshot or {},cache,time.time())
                if selection:
                    track=selection['track']
                    key=(selection['source'],track['id'])
                    remaining=max(0,track['durationMs']/1000-selection['offsetSeconds'])
                    if fallback is None or fallback.poll() is not None or fallback_key!=key or now>=fallback_deadline:
                        stop_vlc(fallback)
                        fallback_key=key
                        fallback_deadline=now+remaining
                        fallback=start_vlc(args.vlc,logfile,
                                           '--start-time=%.3f'%selection['offsetSeconds'],
                                           selection['file'])
                        print('LOCAL_TRACK',selection['source'],track['id'],flush=True)
                else:
                    stop_vlc(fallback)
                    fallback=None
                    fallback_key=None
            STOP.wait(0.5)
    finally:
        PLAYBACK_STATE.update(mode='STOPPED',broadcastRunning=False,streamLastSeen=0.0,mchsIsolatedEventId=None,
                              mchsRelayPrepareEventId=None,mchsRelayAckEventId=None,
                              mchsRelayFirstAckAt=None,mchsRelayLastAckAt=None)
        threading.Thread(target=async_playback_report,args=(args.server,token,
            {'playback':'STOPPED','outputDevice':'VLC (устройство вывода не подтверждено)',
             'lastPacketAgeMs':None,'error':''}),daemon=True).start()
        MCHS_LAB_ONE_SHOT.clear()
        MCHS_AUDIO_ARMED.clear()
        MCHS_AUDIO_START.clear()
        MCHS_AUDIO_STOP.clear()
        if trial_relay is not None:
            trial_relay.closing.set()
        stop_vlc(trial_vlc)
        if local_cycle_session is not None:
            local_cycle_session.stop()
        if event_audio_session is not None:
            event_audio_session.stop()
        if trial_relay is not None:
            trial_relay.shutdown()
            trial_relay.server_close()
        relay.intentional_disconnect.set()
        stop_vlc(primary)
        stop_vlc(fallback)
        relay.shutdown()
        relay.server_close()


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--server',default='https://mediarafraw.ru')
    parser.add_argument('--data-dir',default='radio-agent-data')
    parser.add_argument('--vlc',required=True,help='Full path to vlc.exe')
    parser.add_argument('--enable-headphones-test',action='store_true')
    parser.add_argument('--isolated-event-audio',action='store_true',
                        help='Event-bound local WAV rehearsal only with physical PA isolation')
    parser.add_argument('--isolated-event-danger-wav')
    parser.add_argument('--isolated-event-all-clear-wav')
    parser.add_argument('--isolated-event-admission',action='store_true',
                        help='Operator-isolated event metadata rehearsal; never starts alarm playback')
    parser.add_argument('--isolated-cycle-danger-wav')
    parser.add_argument('--isolated-cycle-all-clear-wav')
    parser.add_argument('--isolated-cycle-repeats',type=int,default=4)
    parser.add_argument('--offline-grace',type=int,default=900,
                        help='Maximum seconds without renewed server authorization, default 15 min')
    args=parser.parse_args()
    if not args.server.startswith('https://') or not args.enable_headphones_test:
        parser.error('HTTPS and explicit --enable-headphones-test consent required')
    if not 30<=args.offline_grace<=3600:
        parser.error('offline-grace must be 30..3600 seconds')
    executable=Path(args.vlc).resolve()
    if not executable.is_file() or executable.name.lower()!='vlc.exe':
        parser.error('Full path to vlc.exe required')
    if args.isolated_event_audio:
        if (args.isolated_event_admission or args.isolated_cycle_danger_wav or
                args.isolated_cycle_all_clear_wav):
            parser.error('Event audio is exclusive with metadata and two-stage cycle')
        if not args.isolated_event_danger_wav or not args.isolated_event_all_clear_wav:
            parser.error('Event audio requires both local training WAV files')
        try:
            danger=verify_local_training_wav(args.isolated_event_danger_wav)
            clear=verify_local_training_wav(args.isolated_event_all_clear_wav)
            if danger['sha256']==clear['sha256']:
                raise ValueError('IDENTICAL_DANGER_AND_ALL_CLEAR')
        except (OSError,ValueError) as error:
            parser.error('Invalid event-audio WAV: '+str(error))
        if input('AA-300 AND ALL PA routes physically disconnected? Type ISOLATED: ').strip()!='ISOLATED':
            parser.error('PHYSICAL_OUTPUT_ISOLATION_REQUIRED')
        args.isolated_event_assets={'MISSILE_DANGER':danger,'MISSILE_ALL_CLEAR':clear}
    if args.isolated_event_admission and (args.isolated_cycle_danger_wav or args.isolated_cycle_all_clear_wav):
        parser.error('Event admission and audio-cycle modes are mutually exclusive')
    if args.isolated_event_admission:
        confirmation=input('No PA route connected; metadata-only event rehearsal? Type ISOLATED: ')
        if confirmation.strip()!='ISOLATED':
            parser.error('PHYSICAL_OUTPUT_ISOLATION_REQUIRED')
    if args.isolated_cycle_danger_wav or args.isolated_cycle_all_clear_wav:
        if not args.isolated_cycle_danger_wav or not args.isolated_cycle_all_clear_wav:
            parser.error('Both isolated cycle WAV paths are required')
        if not 1<=args.isolated_cycle_repeats<=5:
            parser.error('isolated-cycle-repeats must be 1..5')
        try:
            danger=verify_local_training_wav(args.isolated_cycle_danger_wav)
            clear=verify_local_training_wav(args.isolated_cycle_all_clear_wav)
            if danger['sha256']==clear['sha256']:
                raise ValueError('IDENTICAL_DANGER_AND_ALL_CLEAR')
        except (OSError,ValueError) as error:
            parser.error('Isolated training WAV invalid: '+str(error))
        confirmation=input('AA-300 and ALL PA audio routes physically disconnected? Type ISOLATED: ')
        if confirmation.strip()!='ISOLATED':
            parser.error('PHYSICAL_OUTPUT_ISOLATION_REQUIRED')
        args.isolated_cycle_assets=(danger,clear)
    token=os.environ.get('RADIO_AGENT_TOKEN','')
    if not token.startswith('rr_'):
        parser.error('RADIO_AGENT_TOKEN is required')
    try:
        run(args,token)
    except KeyboardInterrupt:
        STOP.set()


if __name__=='__main__':
    main()
