import {describe,it,expect} from 'vitest';
import {assessMchsQueueObservation as assess} from '../src/lib/mchsQueueAssessment.js';
const now=Date.parse('2026-10-28T10:00:00Z');
const input=(title,offset=0)=>({title,body:'',occurredAt:new Date(now+offset).toISOString()});
describe('MCHS queue diagnostic assessment',()=>{
 it('classifies recognized danger as unverified',()=>{
  expect(assess(input('РАКЕТНАЯ ОПАСНОСТЬ'),{nowMs:now})).toMatchObject({status:'ANALYZED',reason:'CLASSIFIED_UNVERIFIED',officialVerified:false,playbackEnabled:false});
 });
 it('rejects unknown texts for playback',()=>{
  expect(assess(input('Справочная информация'),{nowMs:now}).reason).toBe('UNCLASSIFIED');
 });
 it('marks stale observations',()=>{
  expect(assess(input('ОПАСНОСТЬ АТАКИ БПЛА',-240000),{nowMs:now}).reason).toBe('STALE_OBSERVATION');
 });
 it('marks future timestamps',()=>{
  expect(assess(input('ОТБОЙ РАКЕТНОЙ ОПАСНОСТИ',240000),{nowMs:now}).reason).toBe('FUTURE_TIME');
 });
 it('marks missing timestamp',()=>{
  expect(assess({title:'РАКЕТНАЯ ОПАСНОСТЬ'},{nowMs:now}).reason).toBe('UNKNOWN_TIME');
 });
});
