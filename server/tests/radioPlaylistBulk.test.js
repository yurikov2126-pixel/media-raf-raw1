import {describe,it,expect,vi} from 'vitest';
import {validateRadioPlaylistTracks,writeRadioPlaylistItems,MAX_RADIO_PLAYLIST_TRACKS} from '../src/lib/radioPlaylistBulk.js';

describe('large radio playlists',()=>{
 it('accepts 500 and 5000 unique tracks',()=>{
  for(const count of [500,MAX_RADIO_PLAYLIST_TRACKS])
   expect(validateRadioPlaylistTracks(Array.from({length:count},(_,i)=>'asset_'+i))).toBeNull();
 });
 it('reports limits and duplicate IDs',()=>{
  expect(validateRadioPlaylistTracks(Array.from({length:5001},(_,i)=>'asset_'+i))).toMatch(/5000/);
  expect(validateRadioPlaylistTracks(['a','a'])).toMatch(/повторяющиеся/);
  expect(validateRadioPlaylistTracks([''])).toBeTruthy();
 });
 it('writes 501 links in stable order and three bounded batches',async()=>{
  const createMany=vi.fn(async()=>{});
  const db={radioPlaylistItem:{createMany}};
  await writeRadioPlaylistItems(db,'playlist-1',Array.from({length:501},(_,i)=>'a'+i));
  expect(createMany).toHaveBeenCalledTimes(3);
  expect(createMany.mock.calls.map(x=>x[0].data.length)).toEqual([250,250,1]);
  const all=createMany.mock.calls.flatMap(x=>x[0].data);
  expect(all.map(x=>x.position)).toEqual(Array.from({length:501},(_,i)=>i));
  expect(all.every(x=>x.playlistId==='playlist-1')).toBe(true);
 });
});