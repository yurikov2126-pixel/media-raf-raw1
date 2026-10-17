#!/usr/bin/env python3
"""WebRTC live-audio receiver for Radio Agent macOS. No relay/amplifier commands."""
import argparse
import asyncio
import json
import os
import sys

import numpy as np
import socketio
import sounddevice as sd
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate
from aiortc.sdp import candidate_from_sdp
from av.audio.resampler import AudioResampler

NAMESPACE = '/radio-device'
async def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--server',default='https://mediarafraw.ru')
    parser.add_argument('--output',type=int,default=None)
    args=parser.parse_args()
    if not args.server.startswith('https://'): parser.error('HTTPS is required')
    token=os.environ.get('RADIO_AGENT_TOKEN','')
    if not token.startswith('rr_'): parser.error('RADIO_AGENT_TOKEN required')
    sio=socketio.AsyncClient(reconnection=True,reconnection_delay=2,reconnection_attempts=0)
    peer=None
    sink=None
    player=None
    queued=[]
    connecting=False
    joined=False
    async def reset():
        nonlocal peer,sink,player,queued
        if player: player.cancel(); await asyncio.gather(player,return_exceptions=True);player=None
        if peer: await peer.close();peer=None
        if sink: sink.stop();sink.close();sink=None
        queued=[]

    async def listen():
        nonlocal connecting,joined
        if connecting or joined or not sio.connected or peer:
            return
        connecting=True
        try:
            result=await sio.call('radio:studio:listen',namespace=NAMESPACE,timeout=10)
            if not result.get('ok'): print('WAIT',result.get('error','Нет эфира'),flush=True)
            else:
                joined=True
                print('LISTENING',flush=True)
        except (socketio.exceptions.TimeoutError, OSError) as exc:
            print('WAIT_SIGNAL',str(exc),flush=True)
        finally:
            connecting=False

    @sio.event(namespace=NAMESPACE)
    async def connect():
        print('CONNECTED',flush=True)
        await listen()

    @sio.event(namespace=NAMESPACE)
    async def disconnect():
        nonlocal joined
        joined=False
        await reset()
        print('SIGNAL_LOST · waiting for reconnect',flush=True)

    @sio.on('radio:studio:state',namespace=NAMESPACE)
    async def state(data):
        nonlocal joined
        if not data.get('live'):
            joined=False
            if peer: await reset()
        elif not joined and not peer and not data.get('listener'):
            await listen()

    @sio.on('radio:studio:ended',namespace=NAMESPACE)
    async def ended(_payload=None):
        nonlocal joined
        joined=False
        await reset(); print('ENDED · READY_FOR_NEXT',flush=True)

    @sio.on('radio:studio:signal',namespace=NAMESPACE)
    async def signal(data):
        nonlocal peer,player,sink,queued
        payload=data.get('payload') or {}
        source=data.get('from')
        if payload.get('type')=='offer':
            await reset()
            peer=RTCPeerConnection()
            current=peer
            @current.on('connectionstatechange')
            async def connection_changed():
                if current.connectionState == 'failed' and peer is current:
                    print('PEER_FAILED · waiting for next stream',flush=True)
                    await reset()
                    if sio.connected:
                        await sio.emit('radio:studio:leave',namespace=NAMESPACE)
            @current.on('track')
            async def track_received(track):
                nonlocal player,sink
                if track.kind!='audio': return
                sink=sd.OutputStream(samplerate=48000,channels=2,dtype='float32',device=args.output,blocksize=960)
                sink.start()
                print('AUDIO_START',flush=True)
                async def play():
                    resampler=AudioResampler(format='fltp',layout='stereo',rate=48000)
                    while current.connectionState not in ('closed','failed'):
                        frame=await track.recv()
                        for converted in resampler.resample(frame):
                            samples=converted.to_ndarray()
                            if samples.shape[0]==2: samples=samples.T
                            else: samples=samples.reshape((-1,2))
                            await asyncio.to_thread(sink.write,np.ascontiguousarray(samples,dtype=np.float32))
                player=asyncio.create_task(play())
                def on_player_done(task):
                    if not task.cancelled() and task.exception():
                        print('AUDIO_ERROR',repr(task.exception()),flush=True)
                        asyncio.create_task(reset())
                player.add_done_callback(on_player_done)
            await current.setRemoteDescription(RTCSessionDescription(sdp=payload['sdp']['sdp'],type='offer'))
            await current.setLocalDescription(await current.createAnswer())
            await sio.emit('radio:studio:signal',{'target':source,'payload':{
                'type':'answer','sdp':{'type':'answer','sdp':current.localDescription.sdp}}},namespace=NAMESPACE)
            for candidate in queued:
                await current.addIceCandidate(candidate)
            queued=[]
        elif payload.get('type')=='candidate' and payload.get('candidate'):
            obj=payload['candidate']
            if not obj.get('candidate'): return
            cand=candidate_from_sdp(obj['candidate'].replace('candidate:','',1))
            cand.sdpMid=obj.get('sdpMid')
            cand.sdpMLineIndex=obj.get('sdpMLineIndex')
            if peer and peer.remoteDescription: await peer.addIceCandidate(cand)
            else: queued.append(cand)

    try:
        await sio.connect(args.server,auth={'token':token},namespaces=[NAMESPACE],transports=['websocket','polling'])
        while True: await asyncio.sleep(1)
    finally:
        await reset()
        if sio.connected: await sio.disconnect()

if __name__=='__main__':
    try: asyncio.run(main())
    except KeyboardInterrupt: pass
    except Exception as ex: print('ERROR',str(ex),file=sys.stderr,flush=True);sys.exit(1)
