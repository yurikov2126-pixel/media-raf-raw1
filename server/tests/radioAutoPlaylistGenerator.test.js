import {describe,it,expect} from 'vitest';
import {generateRadioAutoPlaylist} from '../src/lib/radioAutoPlaylistGenerator.js';
const tracks=Array.from({length:8},(_,i)=>({id:'song'+i,durationMs:180000,artist:'artist'+i}));
const settings={tracks,jingles:[{id:'j1',durationMs:8000}],durationMs:3600000,fadeMs:2000,jingleEvery:3,seed:'day-1'};
describe('radio automatic playlist draft',()=>{
 it('is deterministic and never exceeds the time budget',()=>{
  const a=generateRadioAutoPlaylist(settings),b=generateRadioAutoPlaylist(settings);
  expect(a).toEqual(b);
  expect(a.durationMs).toBeLessThanOrEqual(settings.durationMs);
  expect(a.items.length).toBeGreaterThan(5);
 });
 it('inserts a jingle after every third song without placing it as a song',()=>{
  const a=generateRadioAutoPlaylist(settings).items;
  const music=a.filter(x=>x.kind==='MUSIC');
  expect(music.length).toBeGreaterThan(3);
  const third=a.findIndex((x,i)=>x.kind==='MUSIC'&&a.slice(0,i+1).filter(y=>y.kind==='MUSIC').length===3);
  expect(a[third+1]?.kind).toBe('JINGLE');
 });
 it('preserves isolation when no playable tracks exist',()=>{
  expect(generateRadioAutoPlaylist({...settings,tracks:[]})).toEqual({items:[],durationMs:0,warnings:['NO_VALID_TRACKS']});
 });
 it('rejects unreasonable time settings',()=>{
  expect(()=>generateRadioAutoPlaylist({...settings,fadeMs:-1})).toThrow();
  expect(()=>generateRadioAutoPlaylist({...settings,durationMs:0})).toThrow();
 });
});
