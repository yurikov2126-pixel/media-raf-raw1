import {describe,it,expect} from 'vitest';
import {playbackAttributions} from '../src/lib/radioPlayoutAttribution.js';
const sample={track:{id:'a',name:'A'},generatedMs:1800,startedAt:'2026-10-18T10:00:00Z',mode:'AUTO_DJ'};
describe('two deck playback attribution',()=>{
 it('records both tracks for a generated crossfade',()=>{
  const events=playbackAttributions({...sample,blend:{nextId:'b',nextName:'B'}});
  expect(events.map(e=>e.id)).toEqual(['a','b']);
  expect(events.every(e=>e.mixed===true)).toBe(true);
 });
 it('records one track without mixing',()=>{
  expect(playbackAttributions({...sample,blend:null})).toHaveLength(1);
 });
 it('does not assert playback for missing or very short PCM',()=>{
  expect(playbackAttributions({...sample,generatedMs:999,blend:{nextId:'b'}})).toEqual([]);
 });
 it('never duplicates the same asset',()=>{
  expect(playbackAttributions({...sample,blend:{nextId:'a'}})).toHaveLength(1);
 });
});
