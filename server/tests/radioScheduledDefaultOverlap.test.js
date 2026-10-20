import {describe,it,expect} from 'vitest';
import {resolveRadioCursor} from '../src/lib/radioTimeline.js';
const make=transitions=>[{id:'slot',playlistId:'playlist',startAt:new Date(0),endAt:new Date(100000),
 playlist:{name:'Radio',items:transitions.map((transition,index)=>({
 asset:{id:'track'+index,name:'Track '+index,durationMs:10000,storageKey:'track'+index},
 transition
 }))}}];
describe('station-wide opt-in default scheduled crossfade',()=>{
 it('overlaps adjacent tracks even without a per-track transition',()=>{
  const result=resolveRadioCursor(make([null,null]),9000,
   {scheduledCrossfade:true,defaultScheduledOverlapMs:1500});
  expect(result.status).toBe('SCHEDULED');
  expect(result.track.blend).toMatchObject({nextId:'track1',overlapMs:1500});
 });
 it('does not override an explicitly configured cut',()=>{
  const result=resolveRadioCursor(make([{mode:'cut'},null]),9000,
   {scheduledCrossfade:true,defaultScheduledOverlapMs:1500});
  expect(result.track.id).toBe('track0');
  expect(result.track.blend).toBeUndefined();
 });
 it('preserves old behavior unless opted in',()=>{
  const result=resolveRadioCursor(make([null,null]),9000,
   {scheduledCrossfade:true});
  expect(result.track.blend).toBeUndefined();
 });
 it('respects the overlap limit for short audio',()=>{
  const slots=make([null,null]);
  slots[0].playlist.items[1].asset.durationMs=1000;
  const result=resolveRadioCursor(slots,9000,
   {scheduledCrossfade:true,defaultScheduledOverlapMs:1500});
  expect(result.track.blend).toBeUndefined();
 });
});
