import test from 'node:test';
import assert from 'node:assert/strict';
import {fadePcmChunk,PCM_BYTES_PER_MS} from '../src/lib/radioPcmSourceFades.js';
const pcm=(frames,value=12000)=>{const b=Buffer.alloc(frames*4);for(let i=0;i<b.length;i+=4){b.writeInt16LE(value,i);b.writeInt16LE(-value,i+2);}return b;};
test('fade attenuates both stereo channels equally at track start',()=>{
 const src=pcm(48000*4),got=fadePcmChunk(src,{totalBytes:src.length,fadeMs:1000});
 assert.ok(Math.abs(got.readInt16LE(0))<100);
 assert.equal(got.readInt16LE(0),-got.readInt16LE(2));
 assert.equal(got.readInt16LE(48000*2*4),12000);
});
test('fade-out attenuates the final sample at end of a scheduled track',()=>{
 const src=pcm(48000*4);
 const got=fadePcmChunk(src,{totalBytes:src.length,fadeMs:1000});
 assert.ok(Math.abs(got.readInt16LE(got.length-4))<100);
 assert.equal(got.readInt16LE(4*48000*2),12000);
});
test('fade works over multiple decoder chunks without resetting envelope',()=>{
 const total=PCM_BYTES_PER_MS*4000;
 const src=pcm(4800);
 const head=fadePcmChunk(src,{positionBytes:0,totalBytes:total,fadeMs:1000});
 const middle=fadePcmChunk(src,{positionBytes:PCM_BYTES_PER_MS*2000,totalBytes:total,fadeMs:1000});
 const tail=fadePcmChunk(src,{positionBytes:total-src.length,totalBytes:total,fadeMs:1000});
 assert.ok(Math.abs(head.readInt16LE(0))<middle.readInt16LE(0));
 assert.equal(middle.readInt16LE(0),12000);
 assert.ok(tail.readInt16LE(tail.length-4)<500);
});
test('short tracks never clip and disabled fade passes bytes unchanged',()=>{
 const src=pcm(4800,32767),got=fadePcmChunk(src,{totalBytes:src.length,fadeMs:1200});
 assert.ok(got.readInt16LE(0)>=0&&got.readInt16LE(0)<32767);
 assert.ok(got.readInt16LE(got.length-4)<32767);
 assert.equal(fadePcmChunk(src,{fadeMs:0}),src);
});
