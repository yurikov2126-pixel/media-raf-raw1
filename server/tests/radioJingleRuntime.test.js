import {describe,it,expect} from 'vitest';
import {shouldInsertJingle,chooseJingleAsset} from '../src/lib/radioJingleRuntime.js';
const settings={enabled:true,dayparts:['DAY'],assetIds:['j1','j2'],everyTracks:3,maxDurationMs:20000};
const now=Date.parse('2026-10-18T12:00:00Z');
describe('live jingle runtime guard',()=>{
 it('inserts only after completed music at configured interval',()=>{
  expect(shouldInsertJingle({settings,daypart:'DAY',completedMusic:3,untilMs:now+30000,nowMs:now})).toBe(true);
  expect(shouldInsertJingle({settings,daypart:'DAY',completedMusic:2,untilMs:now+30000,nowMs:now})).toBe(false);
  expect(shouldInsertJingle({settings,daypart:'DAY',completedMusic:0,untilMs:now+30000,nowMs:now})).toBe(false);
 });
 it('respects disabled flag, night period and scheduled boundary',()=>{
  expect(shouldInsertJingle({settings:{...settings,enabled:false},daypart:'DAY',completedMusic:3,untilMs:Infinity,nowMs:now})).toBe(false);
  expect(shouldInsertJingle({settings,daypart:'NIGHT',completedMusic:3,untilMs:Infinity,nowMs:now})).toBe(false);
  expect(shouldInsertJingle({settings,daypart:'DAY',completedMusic:3,untilMs:now+19999,nowMs:now})).toBe(false);
 });
 it('round-robins eligible station IDs and rejects long jingles',()=>{
  const assets=[{id:'j2',durationMs:14000},{id:'j1',durationMs:8000},{id:'j3',durationMs:40000}];
  expect(chooseJingleAsset(settings,assets,0)?.id).toBe('j1');
  expect(chooseJingleAsset(settings,assets,1)?.id).toBe('j2');
  expect(chooseJingleAsset(settings,assets,2)?.id).toBe('j1');
  expect(chooseJingleAsset(settings,[],0)).toBeNull();
 });
});
