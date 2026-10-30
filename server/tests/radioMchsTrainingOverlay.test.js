import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrainingOverlay,PCM_BYTES_PER_SECOND} from '../src/lib/radioMchsTrainingOverlay.js';

test('disabled by default and cannot preempt station',()=>{
 const x=createTrainingOverlay();
 assert.equal(x.start().ok,false);
 const normal=Buffer.alloc(1920,7);
 assert.equal(x.replace(normal),normal);
});
test('training PCM temporarily replaces identical-sized station frames then resumes',()=>{
 let time=0;
 const pcm=Buffer.alloc(3840,11);
 const x=createTrainingOverlay({enabled:true,pcm,now:()=>time});
 assert.equal(x.start().ok,true);
 const normal=Buffer.alloc(1920,3);
 assert.deepEqual(x.replace(normal),Buffer.alloc(1920,11));
 assert.equal(x.snapshot().active,true);
 assert.deepEqual(x.replace(normal),Buffer.alloc(1920,11));
 assert.equal(x.snapshot().active,false);
 assert.equal(x.replace(normal),normal);
});
test('selected ALARM source is bounded to 10 seconds',()=>{
 const x=createTrainingOverlay({enabled:true});
 assert.equal(x.startWith(Buffer.alloc(1920,8)).ok,true);
 assert.equal(x.replace(Buffer.alloc(1920,2))[0],8);
 assert.equal(x.snapshot().active,false);
});
test('operator STOP restores normal program on next frame',()=>{
 const x=createTrainingOverlay({enabled:true,pcm:Buffer.alloc(38400,9)});
 x.start();
 x.stop();
 const frame=Buffer.alloc(1920,2);
 assert.equal(x.replace(frame),frame);
});
test('hard 10 second wall-clock limit',()=>{
 let t=10;
 const x=createTrainingOverlay({enabled:true,pcm:Buffer.alloc(PCM_BYTES_PER_SECOND*10),now:()=>t});
 x.start();t+=10001;
 assert.equal(x.snapshot().active,false);
 assert.equal(x.replace(Buffer.alloc(1920,4))[0],4);
});
test('invalid/oversized source rejected at configuration',()=>{
 assert.throws(()=>createTrainingOverlay({enabled:true,pcm:Buffer.alloc(PCM_BYTES_PER_SECOND*10+4)}));
 assert.throws(()=>createTrainingOverlay({enabled:true,pcm:Buffer.alloc(7)}));
});
