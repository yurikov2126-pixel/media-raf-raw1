import {describe,it,expect} from 'vitest';
import {DEFAULT_JINGLES,validateJingles,readJingles,planJingleBreaks} from '../src/lib/radioJingles.js';
const assets=[{id:'j1',name:'Позывной',durationMs:9000},{id:'j2',name:'Отбивка',durationMs:15000},{id:'long',name:'Длинная',durationMs:65000}];
describe('station jingle planning',()=>{
 it('keeps feature disabled by default',()=>{
  expect(DEFAULT_JINGLES.enabled).toBe(false);
  expect(planJingleBreaks({tracks:Array(10).fill({}),settings:DEFAULT_JINGLES,daypart:'DAY',assets})).toEqual([]);
 });
 it('inserts alternating valid jingles after every third track',()=>{
  const settings={...DEFAULT_JINGLES,enabled:true,everyTracks:3,assetIds:['j1','j2','long']};
  const result=planJingleBreaks({tracks:Array(10).fill({}),settings,daypart:'DAY',assets});
  expect(result.map(x=>[x.beforeTrack,x.assetId])).toEqual([[3,'j1'],[6,'j2'],[9,'j1']]);
 });
 it('does not plan night insertions outside allowed daypart',()=>{
  const settings={...DEFAULT_JINGLES,enabled:true,assetIds:['j1']};
  expect(planJingleBreaks({tracks:Array(10).fill({}),settings,daypart:'NIGHT',assets})).toEqual([]);
 });
 it('rejects invalid libraries, empty periods and bad interval',()=>{
  expect(()=>validateJingles({...DEFAULT_JINGLES,assetIds:['x','x']})).toThrow();
  expect(()=>validateJingles({...DEFAULT_JINGLES,dayparts:[]})).toThrow();
  expect(()=>validateJingles({...DEFAULT_JINGLES,everyTracks:0})).toThrow();
 });
 it('accepts old missing settings as disabled',async()=>{
  const db={setting:{findUnique:async()=>null}};
  expect((await readJingles(db)).enabled).toBe(false);
 });
});
