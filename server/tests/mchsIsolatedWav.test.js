import test from 'node:test';
import assert from 'node:assert/strict';
import {createIsolatedPcmWavStream,wavHeader} from '../src/lib/mchsIsolatedWav.js';
test('WAV header declares PCM stereo 48kHz and exact payload length',()=>{
 const h=wavHeader(7680);
 assert.equal(h.toString('ascii',0,4),'RIFF');
 assert.equal(h.readUInt32LE(4),7716);
 assert.equal(h.toString('ascii',8,12),'WAVE');
 assert.equal(h.readUInt16LE(22),2);
 assert.equal(h.readUInt32LE(24),48000);
 assert.equal(h.readUInt32LE(40),7680);
});
test('isolated stream reads only private PCM and cleans up after end',()=>{
 const pcm=Buffer.alloc(7680,7);
 let closes=0;
 const source={size:pcm.length,read:(position,size)=>pcm.subarray(position,position+size),
  close:()=>{closes++;}};
 const wav=createIsolatedPcmWavStream(source);
 assert.equal(wav.next().length,3840);
 assert.equal(wav.next().length,3840);
 assert.equal(wav.next(),null);
 wav.close();
 assert.equal(closes,1);
});
test('truncated PCM is rejected and source closed',()=>{
 let closes=0;
 const wav=createIsolatedPcmWavStream({size:3840,read:()=>Buffer.alloc(0),close:()=>{closes++;}});
 assert.throws(()=>wav.next(),/PCM_TRUNCATED/);
 assert.equal(closes,1);
});
test('invalid PCM sizes rejected',()=>{
 assert.throws(()=>wavHeader(3),/INVALID_PCM_LENGTH/);
 assert.throws(()=>wavHeader(0),/INVALID_PCM_LENGTH/);
});
