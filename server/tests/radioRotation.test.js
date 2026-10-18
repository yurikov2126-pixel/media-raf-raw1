import {describe,it,expect} from 'vitest';
import {DEFAULT_ROTATION,validateRotation,rotationPlan,readRotation} from '../src/lib/radioRotation.js';
const assets=[
{id:'x',name:'Energetic',playDurationMs:60000},
{id:'y',name:'Calm',playDurationMs:90000},
{id:'z',name:'Another',playDurationMs:45000},
];
const cfg={...DEFAULT_ROTATION,enabled:true,tags:{x:'ENERGY',y:'CALM',z:'POP'}};
const ms=(time)=>Date.parse(time);
describe('station daypart rotation',()=>{
 it('returns isolated defaults when persisted config is invalid',async()=>{
  const db={setting:{findUnique:async()=>({value:'not-json'})}};
  const first=await readRotation(db);
  first.dayparts.MORNING.push('CALM');
  first.tags.x='POP';
  const second=await readRotation(db);
  expect(second.dayparts.MORNING).not.toContain('CALM');
  expect(second.tags.x).toBeUndefined();
 });
 it('handles Moscow midnight and night-to-morning rollover',()=>{
  expect(rotationPlan(assets,cfg,ms('2026-10-18T20:59:59Z')).daypart).toBe('EVENING');
  expect(rotationPlan(assets,cfg,ms('2026-10-18T21:00:00Z')).daypart).toBe('NIGHT');
  expect(rotationPlan(assets,cfg,ms('2026-10-19T04:00:00Z')).daypart).toBe('MORNING');
 });
 it('is opt-in',()=>expect(rotationPlan(assets,DEFAULT_ROTATION,ms('2026-10-18T05:00:00Z'))).toBeNull());
 it('selects only approved categories for morning in Moscow',()=>{
  const plan=rotationPlan(assets,cfg,ms('2026-10-18T05:00:00Z'));
  expect(plan.daypart).toBe('MORNING');
  expect(plan.items.map(x=>x.id).sort()).toEqual(['x','z']);
 });
 it('changes program at local 11:00 without shifting Moscow clock',()=>{
  const plan=rotationPlan(assets,cfg,ms('2026-10-18T08:00:00Z'));
  expect(plan.daypart).toBe('DAY');
  expect(new Date(plan.anchorMs).toISOString()).toBe('2026-10-18T08:00:00.000Z');
 });
 it('keeps deterministic order after restart',()=>{
  const t=ms('2026-10-18T12:00:00Z');
  expect(rotationPlan(assets,cfg,t)).toEqual(rotationPlan([...assets].reverse(),cfg,t));
 });
 it('rejects unknown category and empty period',()=>{
  expect(()=>validateRotation({...cfg,tags:{x:'UNSAFE'}})).toThrow();
  expect(()=>validateRotation({...cfg,dayparts:{...cfg.dayparts,DAY:[]}})).toThrow();
 });
 it('falls back to complete approved pool when category empty',()=>{
  const p=rotationPlan(assets,cfg,ms('2026-10-18T23:00:00Z'));
  expect(p.items.length).toBeGreaterThan(0);
 });
});