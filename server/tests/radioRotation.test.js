import {describe,it,expect} from 'vitest';
import {DEFAULT_ROTATION,validateRotation,rotationPlan,readRotation,separateArtists,prioritizeUnplayed} from '../src/lib/radioRotation.js';
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
describe('radio artist repeat protection',()=>{
 const tracks=['a1','b1','c1','a2','d1','e1'].map(id=>({id,playDurationMs:60000}));
 const artists={a1:'Band A',a2:'band a',b1:'Band B',c1:'Band C',d1:'Band D',e1:'Band E'};
 it('separates artists around the wrap point when possible',()=>{
  const result=separateArtists(tracks,artists,2);
  expect(result.violations).toBe(0);
  for(let i=0;i<result.items.length;i++){
   for(let step=1;step<=2;step++){
    const a=result.items[i],b=result.items[(i+step)%result.items.length];
    expect((artists[a.id]||'').toLowerCase()).not.toBe((artists[b.id]||'').toLowerCase());
   }
  }
 });
 it('remains deterministic after restart',()=>{
  expect(separateArtists(tracks,artists,2)).toEqual(separateArtists(tracks,artists,2));
 });
 it('reports impossible spacing without dropping recordings',()=>{
  const list=[{id:'a1'},{id:'a2'},{id:'b1'}];
  const result=separateArtists(list,artists,2);
  expect(result.violations).toBeGreaterThan(0);
  expect(result.items).toHaveLength(list.length);
 });
 it('rejects invalid spacing and artist strings',()=>{
  expect(()=>validateRotation({...DEFAULT_ROTATION,artistGap:6})).toThrow();
  expect(()=>validateRotation({...DEFAULT_ROTATION,artists:{x:42}})).toThrow();
 });
 it('keeps previous saved configuration compatible',async()=>{
  const db={setting:{findUnique:async()=>({value:JSON.stringify({
   enabled:true,tags:{},dayparts:DEFAULT_ROTATION.dayparts
  })})}};
  const result=await readRotation(db);
  expect(result.artistGap).toBe(0);
  expect(result.artists).toEqual({});
 });
});

describe('cooldown priority at daypart formation',()=>{
 const items=[{id:'a'},{id:'b'},{id:'c'}];
 const timestamp=Date.parse('2026-10-18T15:00:00Z');
 it('defers recently generated audio without dropping tracks',()=>{
  const history=[{id:'a',startedAt:'2026-10-18T14:55:00Z'}];
  expect(prioritizeUnplayed(items,history,30,timestamp).map(x=>x.id)).toEqual(['b','c','a']);
 });
 it('preserves rotation when no eligible history exists',()=>{
  expect(prioritizeUnplayed(items,[{id:'a',startedAt:'2026-10-18T12:00:00Z'}],30,timestamp)).toEqual(items);
  expect(prioritizeUnplayed(items,[],0,timestamp)).toEqual(items);
 });
 it('validates repeat interval and accepts legacy settings',async()=>{
  expect(()=>validateRotation({...DEFAULT_ROTATION,cooldownMinutes:-1})).toThrow();
  expect(()=>validateRotation({...DEFAULT_ROTATION,cooldownMinutes:241})).toThrow();
  const legacy={...DEFAULT_ROTATION};delete legacy.cooldownMinutes;
  const db={setting:{findUnique:async()=>({value:JSON.stringify(legacy)})}};
  expect((await readRotation(db)).cooldownMinutes).toBe(0);
 });
});
