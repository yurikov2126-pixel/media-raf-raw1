import {describe,it,expect} from 'vitest';
import {chooseJingleAsset} from '../src/lib/radioJingleRuntime.js';
const settings={enabled:true,assetIds:['first','second'],everyTracks:2,dayparts:['DAY'],maxDurationMs:15000};
const assets=[
 {id:'first',name:'Station ID',durationMs:2200},
 {id:'second',name:'News Intro',durationMs:5000},
 {id:'invalid',name:'Too Long',durationMs:20000},
];
describe('real radio jingle selection',()=>{
 it('plays only selected and duration-valid recordings in configured sequence',()=>{
  expect(chooseJingleAsset(settings,assets,0)?.id).toBe('first');
  expect(chooseJingleAsset(settings,assets,1)?.id).toBe('second');
  expect(chooseJingleAsset(settings,assets,2)?.id).toBe('first');
 });
 it('refuses unavailable and long media',()=>{
  expect(chooseJingleAsset(settings,[assets[2]],0)).toBeNull();
  expect(chooseJingleAsset({...settings,assetIds:['invalid']},assets,0)).toBeNull();
 });
});
