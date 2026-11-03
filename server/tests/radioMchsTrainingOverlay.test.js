import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrainingOverlay,PCM_BYTES_PER_SECOND} from '../src/lib/radioMchsTrainingOverlay.js';
test('disabled by default',()=>{const x=createTrainingOverlay();assert.equal(x.start().ok,false);});
test('full source plays past 60 seconds without an arbitrary cutoff',()=>{
 const length=PCM_BYTES_PER_SECOND*61;
 const source={size:length,read:(pos,n)=>Buffer.alloc(n,5),close:()=>{}};
 const x=createTrainingOverlay({enabled:true});
 assert.equal(x.startWith(source).ok,true);
 for(let i=0;i<61*50;i++)x.replace(Buffer.alloc(3840));
 assert.equal(x.snapshot().active,false);
 assert.equal(x.snapshot().lastStopReason,'FILE_COMPLETED');
});
test('stop closes source and restores input',()=>{
 let closed=0;
 const source={size:PCM_BYTES_PER_SECOND*90,read:(_,n)=>Buffer.alloc(n),close:()=>{closed++;}};
 const x=createTrainingOverlay({enabled:true});
 x.startWith(source);x.stop();
 assert.equal(closed,1);assert.equal(x.snapshot().lastStopReason,'OPERATOR_STOP');
 const frame=Buffer.alloc(1920,2);assert.equal(x.replace(frame),frame);
});
test('source short read is fail closed',()=>{
 const x=createTrainingOverlay({enabled:true});
 x.startWith({size:3840,read:()=>Buffer.alloc(0),close:()=>{}});
 assert.deepEqual(x.replace(Buffer.alloc(1920,3)),Buffer.alloc(1920));
 assert.equal(x.snapshot().lastStopReason,'SOURCE_READ_FAILED');
});
test('invalid source rejected',()=>{
 const x=createTrainingOverlay({enabled:true});
 assert.equal(x.startWith({size:7,read:()=>Buffer.alloc(7),close:()=>{}}).ok,false);
});


test('plays the complete file exactly three times then resumes normal audio',()=>{
 const pcm=Buffer.from([1,0,2,0,3,0,4,0]); // two stereo samples
 let closes=0;
 const source={size:pcm.length,read:(pos,n)=>pcm.subarray(pos,pos+n),close:()=>{closes++;}};
 const x=createTrainingOverlay({enabled:true});
 assert.equal(x.startWith(source,{repeats:3}).ok,true);
 assert.equal(x.snapshot().remainingBytes,24);
 const mixed=x.replace(Buffer.alloc(20,0));
 assert.deepEqual(mixed,Buffer.concat([pcm,pcm,pcm.subarray(0,4)]));
 assert.equal(x.snapshot().completedRepeats,2);
 assert.equal(x.snapshot().remainingBytes,4);
 assert.deepEqual(x.replace(Buffer.alloc(4,0)),pcm.subarray(4));
 assert.equal(x.snapshot().active,false);
 assert.equal(x.snapshot().completedRepeats,3);
 assert.equal(x.snapshot().lastStopReason,'FILE_COMPLETED');
 assert.equal(x.snapshot().playedBytes,24);
 assert.equal(closes,1);
 const normal=Buffer.from([9,9,9,9]);
 assert.equal(x.replace(normal),normal);
});
test('end in the middle of an output frame is padded with silence',()=>{
 const x=createTrainingOverlay({enabled:true});
 const file=Buffer.from([2,1,2,1]);
 x.startWith(file);
 assert.deepEqual(x.replace(Buffer.alloc(12,4)),
  Buffer.from([2,1,2,1,0,0,0,0,0,0,0,0]));
 assert.equal(x.snapshot().remainingBytes,0);
});
test('rejects invalid repeat counts without claiming playback',()=>{
 const x=createTrainingOverlay({enabled:true});
 for(const repeats of [0,6,-1,1.2,'3',NaN]){
  const r=x.startWith(Buffer.alloc(8),{repeats});
  assert.equal(r.ok,false);
  assert.equal(r.reason,'INVALID_REPEATS');
  assert.equal(x.snapshot().active,false);
 }
});
test('stop between repetitions does not resume a pending repeat',()=>{
 let closes=0;
 const x=createTrainingOverlay({enabled:true});
 x.startWith({size:8,read:(_,n)=>Buffer.alloc(n,5),close:()=>{closes++;}},{repeats:5});
 x.replace(Buffer.alloc(16));
 assert.equal(x.snapshot().completedRepeats,2);
 assert.equal(x.stop().lastStopReason,'OPERATOR_STOP');
 assert.equal(x.snapshot().remainingBytes,0);
 assert.equal(closes,1);
 assert.equal(x.replace(Buffer.from([4,4,4,4]))[0],4);
});
test('source failure on later repetition does not leak partial frame',()=>{
 let reads=0;
 const x=createTrainingOverlay({enabled:true});
 const source={size:8,read:(_,n)=>++reads===2?Buffer.alloc(0):Buffer.alloc(n,1),close:()=>{}};
 x.startWith(source,{repeats:2});
 assert.deepEqual(x.replace(Buffer.alloc(16)),Buffer.alloc(16));
 assert.equal(x.snapshot().lastStopReason,'SOURCE_READ_FAILED');
 assert.equal(x.snapshot().active,false);
});
