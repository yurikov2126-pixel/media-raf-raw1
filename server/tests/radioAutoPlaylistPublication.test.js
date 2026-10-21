import {describe,it,expect} from 'vitest';
import {prepareAutoPlaylistPublication} from '../src/lib/radioAutoPlaylistPublication.js';
const tracks=[{id:'a',durationMs:120000},{id:'b',durationMs:180000},{id:'j',durationMs:8000}];
const entry=(assetId,kind='MUSIC',fadeMs=2000)=>({assetId,kind,pinned:false,fadeMs});
describe('publish AutoPlaylist as positional radio playlist snapshot',()=>{
 it('preserves repeated tracks and maps incoming fades to previous track',()=>{
  const snapshot=prepareAutoPlaylistPublication([entry('a'),entry('b'),entry('a')],tracks);
  expect(snapshot.assetIds).toEqual(['a','b','a']);
  expect(snapshot.transitions.map(t=>t.overlapMs)).toEqual([2000,2000]);
  expect(snapshot.durationMs).toBe(416000);
 });
 it('cuts around jingles instead of mixing unconfigured voiceovers',()=>{
  const snapshot=prepareAutoPlaylistPublication([entry('a'),entry('j','JINGLE',0),entry('b')],tracks);
  expect(snapshot.transitions.map(t=>t.overlapMs)).toEqual([0,0]);
 });
 it('rejects absent files and empty drafts',()=>{
  expect(()=>prepareAutoPlaylistPublication([],tracks)).toThrow();
  expect(()=>prepareAutoPlaylistPublication([entry('missing')],tracks)).toThrow();
 });
});
