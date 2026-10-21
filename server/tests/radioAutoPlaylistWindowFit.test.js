import {describe,it,expect} from 'vitest';
import {autoPlaylistDraftDuration,fitAutoPlaylistWindow} from '../src/lib/radioAutoPlaylistWindowFit.js';
const song=(id,ms=60000,artist=id)=>({id,durationMs:ms,artist});
const item=(id,ms=60000,kind='MUSIC',fadeMs=0)=>({assetId:id,durationMs:ms,kind,fadeMs});
describe('AutoPlaylist exact-window diagnostics and tail fit',()=>{
 it('fills a short remainder using an eligible complete song',()=>{
  const original=[item('a',60000),item('b',60000)];
  const result=fitAutoPlaylistWindow(original,[song('c',45000)],{
   targetMs:165000,fadeMs:0,minTrackGap:0,minArtistGap:0});
  expect(result.durationMs).toBe(165000);
  expect(result.remainingMs).toBe(0);
  expect(result.items.at(-1).assetId).toBe('c');
 });
 it('does not overlap or pad a jingle boundary',()=>{
  expect(autoPlaylistDraftDuration([item('a'),item('j',8000,'JINGLE'),item('b',60000,'MUSIC',2000)])).toBe(128000);
 });
 it('reports rather than silently extending beyond a time limit',()=>{
  const result=fitAutoPlaylistWindow([item('a',61000)],[],{targetMs:60000});
  expect(result.remainingMs).toBe(-1000);
  expect(result.warnings).toContain('OVER_TARGET');
 });
 it('honors rotation limits when no eligible track fits',()=>{
  const result=fitAutoPlaylistWindow([item('a',60000)],[song('a',30000)],{
   targetMs:90000,minTrackGap:1,minArtistGap:1,fadeMs:0});
  expect(result.remainingMs).toBe(30000);
  expect(result.warnings).toContain('WINDOW_UNFILLED');
 });
});
