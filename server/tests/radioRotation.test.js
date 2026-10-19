import {describe,it,expect} from 'vitest';
import {DEFAULT_ROTATION,validateRotation,rotationPlan,readRotation,separateArtists,prioritizeUnplayed,id3Artist,normalizeArtist,rotationPlaylistAssets} from '../src/lib/radioRotation.js';
const items=[
 {id:'a1',name:'One',playDurationMs:60000,tags:{artist:'Band A'}},
 {id:'b1',name:'Two',playDurationMs:60000,tags:{artist:'Band B'}},
 {id:'c1',name:'Three',playDurationMs:60000,tags:{artist:'Band C'}},
 {id:'a2',name:'Four',playDurationMs:60000,tags:{artist:' band a '}},
 {id:'d1',name:'Five',playDurationMs:60000,tags:{artist:'Band D'}},
 {id:'e1',name:'Six',playDurationMs:60000,tags:{artist:'Band E'}}
];
describe('ID3 artist rotation',()=>{
 it('extracts ID3 artist and normalizes case/whitespace',()=>{
  expect(id3Artist(items[0])).toBe('Band A');
  expect(normalizeArtist(id3Artist(items[3]))).toBe(normalizeArtist(id3Artist(items[0])));
  expect(id3Artist({tags:null})).toBe('');
 });
 it('separates known artists including wraparound if feasible',()=>{
  const result=separateArtists(items,{},2);
  expect(result.violations).toBe(0);
  for(let i=0;i<result.items.length;i++)
   for(let gap=1;gap<=2;gap++)
    expect(normalizeArtist(id3Artist(result.items[i])))
     .not.toBe(normalizeArtist(id3Artist(result.items[(i+gap)%result.items.length])));
 });
 it('does not drop any tracks or classify missing ID3 tags as one artist',()=>{
  const tracks=[{id:'one'},{id:'two'},{id:'three'}];
  const ordered=separateArtists(tracks,{},2);
  expect(ordered.items).toHaveLength(3);
  expect(ordered.violations).toBe(0);
 });
 it('uses full approved pool regardless of daypart and mood',()=>{
  const config={...DEFAULT_ROTATION,enabled:true,artistGap:2};
  const morning=rotationPlan(items,config,Date.parse('2026-10-19T06:00:00Z'));
  const evening=rotationPlan(items,config,Date.parse('2026-10-19T18:00:00Z'));
  expect(morning.items).toEqual(evening.items);
  expect(new Set(morning.items.map(a=>a.id)).size).toBe(items.length);
  expect(morning.daypart).toBeNull();
 });
 it('preserves deterministic order on restart',()=>{
  const conf={...DEFAULT_ROTATION,enabled:true,artistGap:2};
  const now=Date.parse('2026-10-19T12:00:00Z');
  expect(rotationPlan(items,conf,now)).toEqual(rotationPlan([...items].reverse(),conf,now));
 });
 it('reads old category/daypart configuration without using obsolete rules',async()=>{
  const db={setting:{findUnique:async()=>({value:JSON.stringify({
   enabled:true,tags:{a1:'ENERGY'},dayparts:{DAY:['POP']},
   artistGap:3,cooldownMinutes:30,strictCooldown:false,allowCooldownFallback:false
  })})}};
  const result=await readRotation(db);
  expect(result.artistGap).toBe(3);
  expect(result.tags).toBeUndefined();
  expect(result.dayparts).toBeUndefined();
 });
 it('validates separation and cooldown',()=>{
  expect(()=>validateRotation({...DEFAULT_ROTATION,artistGap:6})).toThrow();
  expect(()=>validateRotation({...DEFAULT_ROTATION,cooldownMinutes:241})).toThrow();
 });
});
describe('playout history cooldown',()=>{
 const pool=[{id:'a'},{id:'b'},{id:'c'}];
 it('moves recently generated tracks later',()=>{
  const history=[{id:'a',startedAt:'2026-10-18T14:55:00Z'}];
  expect(prioritizeUnplayed(pool,history,30,Date.parse('2026-10-18T15:00:00Z')).map(a=>a.id)).toEqual(['b','c','a']);
 });
});

describe('approved Auto-DJ playlist scope',()=>{
 it('uses 220 selected tracks instead of 233 library assets',()=>{
  const library=Array.from({length:233},(_,i)=>({id:'asset-'+i,name:'Track '+i,durationMs:60000,tags:{artist:'Artist '+i}}));
  const playlist={status:'APPROVED',items:library.slice(0,220).map(asset=>({asset}))};
  const selected=rotationPlaylistAssets(playlist);
  expect(selected).toHaveLength(220);
  expect(selected.every(track=>track.playDurationMs===60000)).toBe(true);
  const plan=rotationPlan(selected,{...DEFAULT_ROTATION,enabled:true,artistGap:4});
  expect(new Set(plan.items.map(track=>track.id))).toEqual(new Set(library.slice(0,220).map(track=>track.id)));
  expect(plan.items).toHaveLength(220);
 });
 it('does not expose non-approved playlists or unplayable files',()=>{
  const playlist={status:'DRAFT',items:[{asset:{id:'x',durationMs:60000}}]};
  expect(rotationPlaylistAssets(playlist)).toEqual([]);
  expect(rotationPlaylistAssets({...playlist,status:'APPROVED',items:[...playlist.items,{asset:{id:'bad',durationMs:0}}]}).map(x=>x.id)).toEqual(['x']);
 });
 it('normalizes embedded whitespace in ID3 artist names',()=>{
  expect(normalizeArtist('  Band  \t A  ')).toBe('band a');
 });
});
