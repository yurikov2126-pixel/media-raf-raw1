import {describe,it,expect} from 'vitest';
import {chooseQueuedTrack} from '../src/lib/radioEventQueue.js';
import {DEFAULT_ROTATION,validateRotation} from '../src/lib/radioRotation.js';
const items=[{id:'a'},{id:'b'},{id:'c'}];
const now=Date.parse('2026-10-18T12:00:00Z');
describe('strict event queue',()=>{
 it('chooses the least recently played available track',()=>{
  const history=[{id:'a',startedAt:'2026-10-18T11:55:00Z'},{id:'b',startedAt:'2026-10-18T10:00:00Z'}];
  expect(chooseQueuedTrack(items,history,30,now).id).toBe('c');
 });
 it('does not break strict cooldown when all tracks are recent',()=>{
  const history=items.map(item=>({id:item.id,startedAt:'2026-10-18T11:59:00Z'}));
  expect(chooseQueuedTrack(items,history,60,now)).toBeNull();
 });
 it('preserves stable order for brand new tracks',()=>{
  expect(chooseQueuedTrack(items,[],60,now).id).toBe('a');
 });
 it('requires explicit activation in saved settings',()=>{
  expect(DEFAULT_ROTATION.strictCooldown).toBe(false);
  expect(validateRotation({...DEFAULT_ROTATION,strictCooldown:true}).strictCooldown).toBe(true);
  expect(()=>validateRotation({...DEFAULT_ROTATION,strictCooldown:'true'})).toThrow();
 });
});