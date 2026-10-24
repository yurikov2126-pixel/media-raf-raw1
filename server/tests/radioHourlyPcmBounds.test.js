import {describe,it,expect} from 'vitest';
import {boundHourlyPcmChunk as bound,hourlySlotStillAuthorized as slot} from '../src/lib/radioHourlyPcmBounds.js';
const arm={fadeAtBytes:192000,cutAtBytes:480000};
describe('hourly PCM cut gate: frame-accurate',()=>{
 it('passes all packets before the hour fade',()=>{
  expect(bound({chunkBytes:38400,emittedBytes:0,cutAtBytes:null,fadeAtBytes:null}))
   .toMatchObject({takeBytes:38400,dropBytes:0,armed:false});
 });
 it('cuts at exact frame even if decoder emits oversized chunks',()=>{
  expect(bound({...arm,emittedBytes:460800,chunkBytes:38400}))
   .toMatchObject({takeBytes:19200,dropBytes:19200,complete:true});
  expect(bound({...arm,emittedBytes:480000,chunkBytes:38400}))
   .toMatchObject({takeBytes:0,dropBytes:38400,complete:true});
 });
 it('keeps packets unchanged before reaching the cut',()=>{
  expect(bound({...arm,emittedBytes:192000,chunkBytes:38400}))
   .toMatchObject({takeBytes:38400,dropBytes:0,complete:false});
 });
 it('rejects malformed stereo frame, invalid cut and negative offsets',()=>{
  expect(()=>bound({...arm,emittedBytes:0,chunkBytes:1001})).toThrow('INVALID_PCM_FRAME');
  expect(()=>bound({...arm,emittedBytes:192000,chunkBytes:-4})).toThrow('INVALID_PCM_FRAME');
  expect(()=>bound({...arm,cutAtBytes:192000,emittedBytes:192000,chunkBytes:4})).toThrow('INVALID_HOURLY_FADE');
  expect(()=>bound({...arm,emittedBytes:191996,chunkBytes:4})).toThrow('INVALID_HOURLY_FADE');
 });
});
describe('hourly slot guard',()=>{
 it('allows AutoDJ only without approved slot',()=>{
  expect(slot({})).toBe(true);
  expect(slot({activeSlotId:'scheduled'})).toBe(false);
 });
 it('allows the same approved programme during voice insertion',()=>{
  expect(slot({expectedSlotId:'s1',activeSlotId:'s1'})).toBe(true);
  expect(slot({expectedSlotId:'s1',activeSlotId:'s2'})).toBe(false);
  expect(slot({expectedSlotId:'s1'})).toBe(false);
 });
});
