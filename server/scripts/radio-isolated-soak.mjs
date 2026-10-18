#!/usr/bin/env node
/** 30-minute deterministic audio soak; no sound output, no Worker or DB access. */
import {RadioIsolatedPcmLab} from '../src/lib/radioIsolatedPcmLab.js';
import {RadioIsolatedMixOutput} from '../src/lib/radioIsolatedMixOutput.js';
import {RadioPcmLabSoakTelemetry} from '../src/lib/radioPcmLabSoakTelemetry.js';
const total=Number(process.argv[2]||90000);
if(!Number.isSafeInteger(total)||total<50||total>180000)throw new Error('FRAME_COUNT_OUT_OF_RANGE');
const lab=new RadioIsolatedPcmLab({prebufferFrames:1,maxFrames:5});
const mix=new RadioIsolatedMixOutput();
const stats=new RadioPcmLabSoakTelemetry();
const frame=Buffer.alloc(3840);
for(let i=0;i<total;i++){
 const now=1000+i*20;
 const received=lab.push({pcm:frame,frameIndex:i*960},now);
 if(!received.ok)throw new Error('INPUT_'+received.reason+' at '+i);
 stats.receive(received,lab.playout.snapshot(now).bufferedMs);
 const result=lab.tick(now);
 stats.tick(now,result);
 if(!result.ok)throw new Error('PLAYOUT_'+result.reason+' at '+i);
 mix.accept(frame,now);
}
const report={durationMinutes:total/3000,lab:lab.snapshot(1000+(total-1)*20),
 timing:stats.snapshot(1000+(total-1)*20),mix:mix.snapshot()};
console.log(JSON.stringify(report,null,2));
if(report.lab.framesMixed!==total||report.timing.deadlineMisses||report.lab.underruns)
 process.exitCode=2;
console.log('Synthetic deterministic soak only; physical and network tests are still required.');
