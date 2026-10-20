import {describe,it,expect} from 'vitest';
import {resumeScheduledCursor,continuePcmIterator} from '../src/lib/radioPcmHandoverResume.js';
const original={status:'SCHEDULED',slot:{id:'s1'},
 track:{id:'t1',index:0,offsetMs:0,durationMs:90000}};
describe('source handover resume',()=>{
 it('skips the already mixed target prefix without resetting slot clock',()=>{
  expect(resumeScheduledCursor(original,{slotId:'s1',assetId:'t1',consumedFrames:72000}))
   .toMatchObject({slot:{id:'s1'},track:{id:'t1',seekMs:1500,offsetMs:1500,remainingMs:88500}});
 });
 it('does not alter unrelated first tracks or later playlist items',()=>{
  expect(resumeScheduledCursor(original,{slotId:'other',assetId:'t1',consumedFrames:72000})).toBe(original);
  expect(resumeScheduledCursor({...original,track:{...original.track,index:1}},
   {slotId:'s1',assetId:'t1',consumedFrames:72000}).track.index).toBe(1);
 });
 it('reads reserved decoder bytes before streaming further audio',async()=>{
  const rest=Buffer.from('abc');
  const iterator={_radioRest:rest,next:async()=>({done:false,value:Buffer.from('def')})};
  let chunks=[];
  for await(const chunk of continuePcmIterator(iterator)){chunks.push(chunk);if(chunks.length===2)break;}
  expect(Buffer.concat(chunks).toString()).toBe('abcdef');
 });
});
