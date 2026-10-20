import { describe, expect, it } from 'vitest';
import { resolveRadioCursor } from '../src/lib/radioTimeline.js';

const base = Date.parse('2026-10-17T12:00:00.000Z');
const slots = [{
  id: 'slot', playlistId: 'playlist', startAt: new Date(base), endAt: new Date(base+180000),
  playlist: { name: 'Тест', items: [
    { asset: { id: 'first', name: 'Первый', durationMs: 60000 } },
    { asset: { id: 'second', name: 'Второй', durationMs: 120000 } },
  ] },
}];
describe('radio timeline', () => {
  it('does not restart the first track on a mid-slot failover', () => {
    expect(resolveRadioCursor(slots,base+90000).track).toMatchObject({ id:'second',offsetMs:30000,index:1 });
  });
  it('honors exact track boundaries', () => {
    expect(resolveRadioCursor(slots,base+60000).track).toMatchObject({id:'second',offsetMs:0});
  });
  it('returns idle outside the scheduled window', () => {
    expect(resolveRadioCursor(slots,base-1).status).toBe('IDLE');
    expect(resolveRadioCursor(slots,base+180000).status).toBe('IDLE');
  });
  it('does not loop if the slot is longer than the playlist', () => {
    const extended=[{...slots[0],endAt:new Date(base+240000)}];
    expect(resolveRadioCursor(extended,base+210000)).toMatchObject({status:'IDLE',track:null});
  });
});

describe('opt-in scheduled PCM crossfade cursor',()=>{
 const start=Date.parse('2026-10-20T10:00:00Z');
 const config=[{id:'show',playlistId:'list',startAt:new Date(start),endAt:new Date(start+180000),playlist:{
  name:'Show',items:[
   {asset:{id:'a',name:'A',durationMs:60000,storageKey:'a.wav'},
    transition:{mode:'crossfade',overlapMs:6000,curve:'equalPower'}},
   {asset:{id:'b',name:'B',durationMs:60000,storageKey:'b.wav'},
    transition:{mode:'crossfade',overlapMs:4000,curve:'linear'}},
   {asset:{id:'c',name:'C',durationMs:60000,storageKey:'c.wav'}}
  ]}}];
 const at=offset=>resolveRadioCursor(config,start+offset,{scheduledCrossfade:true});
 it('uses legacy clock when flag is absent',()=>{
  expect(resolveRadioCursor(config,start+55000).track).toMatchObject({id:'a',offsetMs:55000});
 });
 it('starts overlap before the old track ends and keeps seek positions',()=>{
  expect(at(53999).track).toMatchObject({id:'a',offsetMs:53999,remainingMs:1});
  expect(at(54000).track).toMatchObject({id:'a',index:0,blend:{nextId:'b',overlapMs:6000,blendPosition:0,nextSeekMs:0}});
  expect(at(57500).track).toMatchObject({id:'a',blend:{nextId:'b',blendPosition:3500,nextSeekMs:3500}});
  expect(at(60000).track).toMatchObject({id:'b',index:1,offsetMs:6000});
 });
 it('handles independent overlap on next pair without replaying head of B',()=>{
  expect(at(110000).track).toMatchObject({id:'b',blend:{nextId:'c',overlapMs:4000,blendPosition:0}});
  expect(at(114000).track).toMatchObject({id:'c',offsetMs:4000});
  expect(at(170000)).toMatchObject({status:'IDLE',track:null});
 });
});
