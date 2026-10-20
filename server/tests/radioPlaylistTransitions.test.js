import {describe,it,expect} from 'vitest';
import {validatePlaylistTransitions,validateTransitionSpans,scheduledPlaylistDuration,transitionMapByPair} from '../src/lib/radioPlaylistTransitions.js';

describe('editorial scheduled playlist transitions',()=>{
 const ids=['a','b','c'];
 const assets=[
  {assetId:'a',durationMs:120000},{assetId:'b',durationMs:100000},{assetId:'c',durationMs:80000},
 ];
 it('defaults to hard cuts and never creates a trailing transition',()=>{
  const options=validatePlaylistTransitions(ids);
  expect(options).toHaveLength(2);
  expect(options.every(x=>x.overlapMs===0)).toBe(true);
 });
 it('persists two independent overlap settings',()=>{
  const options=validatePlaylistTransitions(ids,[
   {mode:'crossfade',overlapMs:6000,curve:'equalPower'},
   {mode:'crossfade',overlapMs:2500,curve:'sCurve'},
  ]);
  const items=assets.map((x,i)=>({...x,transition:options[i]}));
  expect(scheduledPlaylistDuration(items)).toBe(291500);
  expect(transitionMapByPair(items).get('a|b')).toEqual(options[0]);
  expect(transitionMapByPair(items).get('b|c')).toEqual(options[1]);
 });
 it('rejects unbounded overlap and malformed curves',()=>{
  expect(()=>validatePlaylistTransitions(ids,[{mode:'crossfade',overlapMs:16000,curve:'linear'}])).toThrow();
  expect(()=>validatePlaylistTransitions(ids,[{mode:'crossfade',overlapMs:6000,curve:'unknown'}])).toThrow();
  expect(()=>validatePlaylistTransitions(ids,[{}, {}, {}])).toThrow();
 });
 it('rejects overlap longer than half of shorter track',()=>{
  expect(()=>validateTransitionSpans([{durationMs:9000,transition:{overlapMs:6000}},{durationMs:8000}])).toThrow();
 });
 it('does not create transition past playlist end',()=>{
  const options=validatePlaylistTransitions(['only'],[]);
  expect(options).toEqual([]);
 });
});
