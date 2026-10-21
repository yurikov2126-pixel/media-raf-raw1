import {describe,it,expect,vi} from 'vitest';
import {validateAutoPlaylistInput,collectAutoPlaylistAssets,previewAutoPlaylist} from '../src/lib/radioAutoPlaylistService.js';
const input={name:'Daytime',sourceFolderId:'root',targetMinutes:10,
 minTrackGap:1,minArtistGap:2,jingleAssetIds:['j1'],jingleEvery:2,fadeMs:2000};
const db={
 radioAssetFolder:{
  findUnique:vi.fn(async()=>({id:'root'})),
  findMany:vi.fn(async({where})=>where.parentId.in.includes('root')?[{id:'child'}]:[])
 },
 radioAsset:{findMany:vi.fn(async({where})=>where.folderId?
  [{id:'song1',name:'A',durationMs:180000,tags:{artist:'Artist A'}},
   {id:'song2',name:'B',durationMs:180000,tags:{artist:'Artist B'}}]:
  [{id:'j1',name:'Jingle',durationMs:8000,tags:{}}])}
};
describe('Radio AutoPlaylist draft service',()=>{
 it('validates artist spacing, fade and jingle configuration',()=>{
  expect(validateAutoPlaylistInput(input).minArtistGap).toBe(2);
  expect(()=>validateAutoPlaylistInput({...input,minArtistGap:-3})).toThrow();
  expect(()=>validateAutoPlaylistInput({...input,jingleAssetIds:['j1','j1']})).toThrow();
 });
 it('traverses child folders and excludes selected jingles from music',async()=>{
  const result=await collectAutoPlaylistAssets(validateAutoPlaylistInput(input),db);
  expect(result.tracks.map(x=>x.id)).toEqual(['song1','song2']);
  expect(result.jingles.map(x=>x.id)).toEqual(['j1']);
  expect(db.radioAssetFolder.findMany).toHaveBeenCalled();
 });
 it('generates a preview without writing to the database',async()=>{
  const result=await previewAutoPlaylist(validateAutoPlaylistInput(input),{db,seed:'stable'});
  expect(result.items.length).toBeGreaterThan(0);
  expect(result.durationMs).toBeLessThanOrEqual(600000);
 });
});
