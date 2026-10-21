import {describe,it,expect} from 'vitest';
import {mergePinnedAutoPlaylist} from '../components/radioAutoPlaylistPinned.js';
const music=(id,pinned=false)=>({assetId:id,kind:'MUSIC',durationMs:60000,fadeMs:2000,pinned});
describe('AutoPlaylist pinned regeneration',()=>{
 it('preserves exact pinned indexes while filling remaining positions',()=>{
  const original=[music('a'),music('fixed',true),music('b'),music('last',true)];
  const result=mergePinnedAutoPlaylist(original,[music('new1'),music('fixed'),music('new2'),music('last'),music('new3')]);
  expect(result[1].assetId).toBe('fixed');
  expect(result[3].assetId).toBe('last');
  expect(result[1].pinned).toBe(true);
  expect(result.filter(x=>x.assetId==='fixed')).toHaveLength(1);
  expect(result.filter(x=>x.assetId==='last')).toHaveLength(1);
 });
 it('handles pins past the length of the newly generated list',()=>{
  const original=[music('x'),music('y'),music('z'),music('pin',true)];
  const result=mergePinnedAutoPlaylist(original,[music('new')]);
  expect(result[3].assetId).toBe('pin');
  expect(result.slice(0,3).map(x=>x.assetId)).toEqual(['new','x','y']);
 });
 it('preserves unlocked new result when no items are pinned',()=>{
  expect(mergePinnedAutoPlaylist([music('old')],[music('new')])).toEqual([music('new')]);
 });
});
