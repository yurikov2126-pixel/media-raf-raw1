#!/usr/bin/env python3
"""Local macOS mic monitor (pilot only): sounddevice/PortAudio, no network broadcast."""
import argparse
import json
import sys
import time
import sounddevice as sd

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--list',action='store_true')
    p.add_argument('--input',type=int)
    p.add_argument('--output',type=int)
    p.add_argument('--samplerate',type=int,default=48000)
    a=p.parse_args()
    if a.list:
        for i,d in enumerate(sd.query_devices()):
            if d['max_input_channels'] or d['max_output_channels']:
                print(json.dumps({'id':i,'name':d['name'],'inputs':d['max_input_channels'],'outputs':d['max_output_channels']},ensure_ascii=False),flush=True)
        return
    if a.input is None or a.output is None:
        p.error('Choose input and output explicitly')
    inp=sd.query_devices(a.input); out=sd.query_devices(a.output)
    if inp['max_input_channels']<1 or out['max_output_channels']<1:
        p.error('Selected input/output not available')
    peak=0.
    last=0.
    def callback(indata,outdata,frames,time_info,status):
        nonlocal peak,last
        if status: print('AUDIO_STATUS',str(status),flush=True)
        # Mono monitor copied to every output channel; never route to hardware control.
        outdata[:] = indata[:, :1]
        v=float(abs(indata).max())
        if v>peak: peak=v
        now=time.monotonic()
        if now-last>=0.2:
            print('LEVEL',round(peak,4),flush=True)
            peak=0.
            last=now
    with sd.Stream(device=(a.input,a.output),samplerate=a.samplerate,
                   channels=(1,2 if out['max_output_channels']>=2 else 1),
                   dtype='float32',latency='low',blocksize=0,callback=callback):
        print('MIC_RUNNING',flush=True)
        while True: time.sleep(0.25)

if __name__=='__main__':
    try: main()
    except KeyboardInterrupt: pass
