import {describe,it,expect} from 'vitest';
import {reserveCrossfadePair,safeCrossfadeDuration} from '../src/lib/radioQueueCrossfade.js';
const now=Date.parse('2026-10-18T12:00:00Z');
const items=[{id:'a',playDurationMs:60000},{id:'b',playDurationMs:45000},{id:'c',playDurationMs:70000}];
describe('event queue dual-deck reservation',()=>{
 it('reserves two different eligible tracks without modifying history',()=>{
  const history=[{id:'a',startedAt:'2026-10-18T11:55:00Z'}];
  const original=JSON.stringify(history);
  const plan=reserveCrossfadePair(items,history,30,now);
  expect(plan.status).toBe('READY');
  expect(plan.first.id).toBe('b');
  expect(plan.second.id).toBe('c');
  expect(JSON.stringify(history)).toBe(original);
 });
 it('returns SOLO if second deck is on cooldown',()=>{
  const history=[{id:'b',startedAt:'2026-10-18T11:59:00Z'},{id:'c',startedAt:'2026-10-18T11:59:00Z'}];
  expect(reserveCrossfadePair(items,history,30,now).status).toBe('SOLO');
 });
 it('does not reserve a track when none is eligible',()=>{
  const history=items.map(a=>({id:a.id,startedAt:'2026-10-18T11:59:00Z'}));
  expect(reserveCrossfadePair(items,history,30,now).status).toBe('EMPTY');
 });
 it('respects next broadcast boundary and short cue spans',()=>{
  expect(safeCrossfadeDuration(items[0],items[1],3000,now+1000,now)).toBe(1000);
  expect(safeCrossfadeDuration(items[0],items[1],3000,now+100,now)).toBe(0);
  expect(safeCrossfadeDuration({...items[0],playDurationMs:400},items[1],3000,Infinity,now)).toBe(0);
 });
 it('never selects preferred first track as second source',()=>{
  const plan=reserveCrossfadePair(items,[],30,now,'c');
  expect(plan.first.id).toBe('c');
  expect(plan.second.id).not.toBe('c');
 });
});