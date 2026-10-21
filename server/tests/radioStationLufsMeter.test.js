import {describe,it,expect} from 'vitest';
import {parseEbur128Frame,createStationLufsMeter} from '../src/lib/radioStationLufsMeter.js';

describe('Radio server EBU R128',()=>{
 it('reads momentary, integrated and the highest stereo true peak',()=>{
  const line='[Parsed_ebur128_0] t: 3.199 TARGET:-23 LUFS M: -17.2 S: -18.1 I: -18.4 LUFS LRA: 0.0 LU FTPK: -1.4 -2.0 dBFS TPK: -0.9 -1.3 dBFS';
  expect(parseEbur128Frame(line)).toEqual({momentary:-17.2,integrated:-18.4,truePeak:-0.9});
 });
 it('ignores unrelated FFmpeg logs',()=>{
  expect(parseEbur128Frame('Input #0, mp3, from pipe:0')).toBeNull();
 });
 it('returns null peak for silence / non-finite values',()=>{
  const line='t: 0.099 TARGET:-23 LUFS M: -inf S: -inf I: -70.0 LUFS LRA: 0.0 LU TPK: -inf -inf dBFS';
  const value=parseEbur128Frame(line);
  expect(value.integrated).toBe(-70);
  expect(Number.isFinite(value.momentary)).toBe(false);
  expect(value.truePeak).toBeNull();
 });
 it('does not spawn analysis when explicitly disabled',()=>{
  const m=createStationLufsMeter({enabled:false});
  expect(m.snapshot().status).toBe('DISABLED');m.observe(Buffer.alloc(10));m.close();
 });
});
