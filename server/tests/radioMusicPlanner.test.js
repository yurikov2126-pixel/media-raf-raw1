import {describe,it,expect} from 'vitest';
import {previewMusicQueue} from '../src/lib/radioMusicPlanner.js';
import {DEFAULT_ROTATION} from '../src/lib/radioRotation.js';
const assets=[{id:'a',name:'A',durationMs:60000},{id:'b',name:'B',durationMs:60000},{id:'c',name:'C',durationMs:60000}];
const base={rotation:{...DEFAULT_ROTATION,enabled:true,tags:{a:'POP',b:'POP',c:'ENERGY'}},cues:{}};
const now=Date.parse('2026-10-18T12:00:00Z');
describe('radio upcoming playlist planning',()=>{
 it('returns only enabled categories for the current Moscow daypart',()=>{
  const result=previewMusicQueue({assets,settings:base,nowMs:now});
  expect(result.tracks.map(x=>x.id).sort()).toEqual(['a','b','c']);
  expect(result.tracks.every(x=>x.durationMs===60000)).toBe(true);
 });
 it('does not mutate actual playback history',()=>{
  const history=[{id:'a',startedAt:'2026-10-18T11:59:00Z',mode:'AUTO_DJ'}];
  const before=JSON.stringify(history);
  const plan=previewMusicQueue({assets,settings:{...base,rotation:{...base.rotation,strictCooldown:true,cooldownMinutes:30}},history,nowMs:now});
  expect(plan.tracks.some(t=>t.id==='a')).toBe(false);
  expect(JSON.stringify(history)).toBe(before);
 });
 it('does not claim playout for disabled rotation',()=>{
  const plan=previewMusicQueue({assets,settings:{...base,rotation:DEFAULT_ROTATION},nowMs:now});
  expect(plan.mode).toBe('DISABLED');
  expect(plan.tracks).toEqual([]);
 });
});
