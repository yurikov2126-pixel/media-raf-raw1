import {describe,it,expect} from 'vitest';
import {reserveCrossfadePair,safeCrossfadeDuration} from '../src/lib/radioQueueCrossfade.js';
describe('strict queue crossfade readiness guard',()=>{
 const now=Date.parse('2026-10-18T12:00:00Z');
 const items=[{id:'one',playDurationMs:30000},{id:'two',playDurationMs:40000}];
 it('does not make a second source audible or change history when reserving',()=>{
  const history=[];
  const result=reserveCrossfadePair(items,history,30,now,'one');
  expect(result.status).toBe('READY');
  expect(result.second.id).toBe('two');
  expect(history).toEqual([]);
 });
 it('does not permit crossfade across a scheduled start',()=>{
  expect(safeCrossfadeDuration(items[0],items[1],3000,now+100,now)).toBe(0);
 });
 it('does not reserve a blocked second source',()=>{
  const result=reserveCrossfadePair(items,[{id:'two',startedAt:'2026-10-18T11:59:00Z'}],30,now,'one');
  expect(result.status).toBe('SOLO');
  expect(result.second).toBeNull();
 });
});
