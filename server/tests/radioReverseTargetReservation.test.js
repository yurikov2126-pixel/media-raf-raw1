import {describe,it,expect} from 'vitest';
import {reserveReverseTarget,validateReverseTarget} from '../src/lib/radioReverseTargetReservation.js';
const base={asset:{id:'song-1'},playlistId:'pl-1',slotId:'show-1',
 slotEndMs:20000,seekMs:500,durationMs:60000,nowMs:16000};
describe('reverse AutoDJ identity reservation',()=>{
 it('pins exact cue and source identity',()=>{
  const r=reserveReverseTarget(base);
  expect(r).toMatchObject({assetId:'song-1',seekMs:500,slotEndMs:20000});
  expect(validateReverseTarget(r,{nowMs:19500,slotId:'show-1',slotEndMs:20000,
   playlistId:'pl-1',assetIds:['song-1'],autoDjEnabled:true})).toMatchObject({valid:true});
 });
 it('does not reuse reservation after config or active show changes',()=>{
  const r=reserveReverseTarget(base);
  for(const patch of [{playlistId:'other'},{assetIds:[]},{slotId:'new-show'},
   {autoDjEnabled:false},{publicLive:true},{nowMs:30000}]){
   const result=validateReverseTarget(r,{nowMs:19500,slotId:'show-1',slotEndMs:20000,
    playlistId:'pl-1',assetIds:['song-1'],autoDjEnabled:true,...patch});
   expect(result.valid).toBe(false);
  }
 });
 it('rejects expired, short, or already-ended candidate',()=>{
  expect(reserveReverseTarget({...base,slotEndMs:15000})).toBe(null);
  expect(reserveReverseTarget({...base,durationMs:900})).toBe(null);
 });
});
