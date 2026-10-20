import {describe,it,expect} from 'vitest';
import {scheduledSuccessor} from '../src/lib/radioScheduledPrewarm.js';
const items=[{assetId:'a'},{assetId:'b'},{assetId:'c'}];
describe('scheduled PCM prewarm',()=>{
 it('selects the next asset at a discrete boundary',()=>{
  expect(scheduledSuccessor(items,{status:'SCHEDULED',track:{index:0}})).toBe('b');
  expect(scheduledSuccessor(items,{status:'SCHEDULED',track:{index:1}})).toBe('c');
 });
 it('does not launch a duplicate successor during existing crossfade',()=>{
  expect(scheduledSuccessor(items,{status:'SCHEDULED',track:{index:0,blend:{nextId:'b'}}})).toBeNull();
 });
 it('never advances beyond scheduled programme or while AutoDJ is selected',()=>{
  expect(scheduledSuccessor(items,{status:'SCHEDULED',track:{index:2}})).toBeNull();
  expect(scheduledSuccessor(items,{status:'AUTO_DJ',track:{index:0}})).toBeNull();
  expect(scheduledSuccessor(items,{status:'SCHEDULED',track:null})).toBeNull();
 });
});
