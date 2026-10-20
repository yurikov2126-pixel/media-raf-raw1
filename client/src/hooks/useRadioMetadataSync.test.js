import {describe,it,expect} from 'vitest';
import {metadataAt,estimateAudioBufferSeconds} from './useRadioMetadataSync.js';

describe('radio metadata sync',()=>{
 const history=[
  {receivedAt:10000,payload:{track:'one'}},
  {receivedAt:15000,payload:{track:'two'}},
  {receivedAt:20000,payload:{track:'three'}},
 ];
 it('delays metadata changes by chosen seconds',()=>{
  expect(metadataAt(history,22000,8).track).toBe('one');
  expect(metadataAt(history,23000,8).track).toBe('two');
 });
 it('returns current metadata without correction',()=>{
  expect(metadataAt(history,22000,0).track).toBe('three');
 });
 it('shows earliest data while collecting latency history',()=>{
  expect(metadataAt(history,12000,8).track).toBe('one');
 });
 it('does not claim to measure a non-seekable live MP3',()=>{
  expect(estimateAudioBufferSeconds({currentTime:5,seekable:{length:0},buffered:{length:1}})).toBeNull();
 });
 it('accepts bounded seekable delay',()=>{
  expect(estimateAudioBufferSeconds({currentTime:12,seekable:{length:1,end:()=>20},buffered:{length:1}})).toBe(8);
 });
});
