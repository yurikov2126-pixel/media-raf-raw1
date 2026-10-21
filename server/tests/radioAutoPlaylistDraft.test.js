import {describe,it,expect} from 'vitest';
import {validateAutoPlaylistDraft} from '../src/lib/radioAutoPlaylistDraft.js';
const assets=[{id:'a',durationMs:180000},{id:'b',durationMs:200000},{id:'j',durationMs:8000}];
describe('editable AutoPlaylist draft',()=>{
 it('recalculates overlap duration and preserves pinned positions',()=>{
  const result=validateAutoPlaylistDraft([
   {assetId:'a',kind:'MUSIC',pinned:true,fadeMs:2000},
   {assetId:'b',kind:'MUSIC',pinned:false,fadeMs:2000},
   {assetId:'j',kind:'JINGLE',pinned:false,fadeMs:0},
  ],assets);
  expect(result.durationMs).toBe(386000);
  expect(result.items[0].pinned).toBe(true);
 });
 it('rejects assets that no longer exist',()=>{
  expect(()=>validateAutoPlaylistDraft([{assetId:'missing',kind:'MUSIC',pinned:false,fadeMs:0}],assets)).toThrow();
 });
 it('rejects invalid fade or malformed pinned values',()=>{
  expect(()=>validateAutoPlaylistDraft([{assetId:'a',kind:'MUSIC',pinned:'yes',fadeMs:0}],assets)).toThrow();
 });
});
