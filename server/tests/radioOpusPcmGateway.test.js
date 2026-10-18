import {describe,it,expect} from 'vitest';
import {pcmPacketize,createOpusPcmDecoder} from '../src/lib/radioOpusPcmGateway.js';
async function* chunks(...items){for(const item of items)yield Buffer.from(item);}
describe('Opus gateway PCM packetization',()=>{
 it('preserves sample order and frame indices across arbitrary decoder chunks',async()=>{
  const result=[];
  for await(const item of pcmPacketize(chunks([1,2,3],[4,5,6,7,8],[9,10,11,12]),{packetBytes:8}))
   result.push(item);
  expect(result.map(p=>p.frameIndex)).toEqual([0]);
  expect([...result[0].pcm]).toEqual([1,2,3,4,5,6,7,8]);
 });
 it('drops incomplete tail rather than padding old PCM',async()=>{
  const result=[];
  for await(const item of pcmPacketize(chunks([1,2,3,4,5]),{packetBytes:8}))result.push(item);
  expect(result).toEqual([]);
 });
 it('rejects invalid buffer constraints',async()=>{
  await expect(async()=>{
   for await(const item of pcmPacketize(chunks([1,2,3,4]),{packetBytes:7}))void item;
  }).rejects.toThrow(TypeError);
 });
 it('creates ffmpeg decoder with fixed PCM output format',()=>{
  let observed;
  const fake={};
  expect(createOpusPcmDecoder({spawnProcess:(cmd,args,opts)=>{observed={cmd,args,opts};return fake;}})).toBe(fake);
  expect(observed.args).toContain('s16le');
  expect(observed.args).toContain('48000');
  expect(observed.args).toContain('webm');
  expect(observed.opts.stdio).toEqual(['pipe','pipe','pipe']);
 });
});
