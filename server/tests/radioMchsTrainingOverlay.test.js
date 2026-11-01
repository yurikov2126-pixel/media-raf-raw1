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
