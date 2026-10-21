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
 it('requires beginning and ending jingles',()=>{
  const result=generateRadioAutoPlaylist(settings);
  expect(result.items[0].kind).toBe('JINGLE');
  expect(result.items.at(-1).kind).toBe('JINGLE');
  expect(generateRadioAutoPlaylist({...settings,jingles:[]}).warnings).toContain('OPENING_CLOSING_JINGLES_REQUIRED');
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

describe('configurable artist rotation',()=>{
 it('keeps two other artists between appearances when possible',()=>{
  const songs=[
   {id:'a1',artist:'Группа А',durationMs:60000},
   {id:'a2',artist:' группа а ',durationMs:60000},
   {id:'b1',artist:'Исполнитель Б',durationMs:60000},
   {id:'c1',artist:'Исполнитель В',durationMs:60000},
   {id:'d1',artist:'Исполнитель Г',durationMs:60000},
  ];
  const result=generateRadioAutoPlaylist({tracks:songs,durationMs:540000,fadeMs:0,
   jingleEvery:0,jingles:[{id:'j',durationMs:8000}],minTrackGap:0,minArtistGap:2,order:'SMART'});
  const artists=Object.fromEntries(songs.map(x=>[x.id,x.artist.trim().toLocaleLowerCase('ru-RU')]));
  const sequence=result.items.filter(x=>x.kind==='MUSIC').map(x=>artists[x.assetId]);
  for(let i=1;i<sequence.length;i++)
   expect(sequence.slice(Math.max(0,i-2),i)).not.toContain(sequence[i]);
 });
 it('warns and continues when the source folder has just one artist',()=>{
  const result=generateRadioAutoPlaylist({tracks:[
   {id:'s1',artist:'One',durationMs:60000},
   {id:'s2',artist:'ONE',durationMs:60000}
  ],jingles:[{id:'j',durationMs:8000}],durationMs:300000,fadeMs:0,jingleEvery:0,minTrackGap:0,minArtistGap:2});
  expect(result.items.length).toBeGreaterThan(1);
  expect(result.warnings).toContain('ARTIST_GAP_RELAXED');
 });
 it('rejects invalid artist rotation settings',()=>{
  expect(()=>generateRadioAutoPlaylist({...settings,minArtistGap:-1})).toThrow();
 });
});
