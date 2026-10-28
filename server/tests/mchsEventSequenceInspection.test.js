import { describe,it,expect } from 'vitest';
import { inspectMchsEventSequence as inspect } from '../src/lib/mchsEventSequenceInspection.js';

const now=Date.parse('2026-10-28T09:30:00Z');
const alarm={id:'alarm-1',category:'ALARM',mimeType:'audio/mpeg',durationMs:9000};
const rules={UAV_DANGER:{mode:'REVIEW',audioAssetId:'alarm-1'},UAV_ALL_CLEAR:{mode:'REVIEW',audioAssetId:'alarm-1'},
 MISSILE_DANGER:{mode:'REVIEW',audioAssetId:'alarm-1'},MISSILE_ALL_CLEAR:{mode:'REVIEW',audioAssetId:'alarm-1'}};
const event=(sourceEventId,title,offset=0)=>({sourceEventId,title,occurredAt:new Date(now+offset).toISOString()});
const base={rules,assets:[alarm],nowMs:now,previous:{mode:'AUTO_DJ',trackId:'old'},
 current:{mode:'AUTO_DJ',id:'new'},scheduleKnown:true,scheduleActive:false};
describe('MCHS sequence inspection never dispatches',()=>{
 it('classifies four standard notification types without performing output',()=>{
  const events=[event('1','ОПАСНОСТЬ АТАКИ БПЛА'),event('2','ОТБОЙ опасности атаки БПЛА'),
   event('3','РАКЕТНАЯ ОПАСНОСТЬ'),event('4','ОТБОЙ РАКЕТНОЙ ОПАСНОСТИ')];
  const result=inspect({...base,events});
  expect(result.results.map(x=>x.eventType)).toEqual(['UAV_DANGER','UAV_ALL_CLEAR','MISSILE_DANGER','MISSILE_ALL_CLEAR']);
  expect(result.results.every(x=>x.canDispatch===false)).toBe(true);
  expect(result.output).toBe('NONE');
 });
 it('blocks repeated and stale events',()=>{
  const result=inspect({...base,events:[event('same','РАКЕТНАЯ ОПАСНОСТЬ'),event('same','РАКЕТНАЯ ОПАСНОСТЬ'),
    event('old','ОТБОЙ РАКЕТНОЙ ОПАСНОСТИ',-360000)]});
  expect(result.results[1].reasons).toContain('DUPLICATE_OR_MISSING_EVENT_ID');
  expect(result.results[2].reasons).toContain('STALE_EVENT');
 });
 it('fails closed on absent ALARM and disabled rule',()=>{
  const result=inspect({...base,assets:[],rules:{UAV_DANGER:{mode:'IGNORE',audioAssetId:'alarm-1'}},
    events:[event('1','ОПАСНОСТЬ АТАКИ БПЛА')]});
  expect(result.results[0].reasons).toEqual(expect.arrayContaining(['INVALID_ALARM_ASSET','RULE_DISABLED']));
 });
 it('uses current scheduled slot rather than saved AutoDJ track',()=>{
  const result=inspect({...base,events:[event('1','ОПАСНОСТЬ АТАКИ БПЛА')],
    current:{mode:'SCHEDULED',slotId:'slot-new'},scheduleActive:true});
  expect(result.resume.action).toBe('RESOLVE_SCHEDULED_AT_CURRENT_POSITION');
  expect(result.resume.slotId).toBe('slot-new');
 });
 it('never interrupts an active live presenter',()=>{
  const result=inspect({...base,events:[event('1','РАКЕТНАЯ ОПАСНОСТЬ')],
   current:{mode:'LIVE',id:'host'},liveActive:true});
  expect(result.results[0].reasons).toContain('LIVE_SOURCE_PROTECTED');
  expect(result.resume.reason).toBe('LIVE_HAS_PRIORITY');
 });
 it('still cannot dispatch if all caller-supplied gates report true',()=>{
  const result=inspect({...base,events:[event('1','РАКЕТНАЯ ОПАСНОСТЬ')],
   officialVerified:true,physicalOutputIsolated:true,publicStreamIsolated:true});
  expect(result.results[0].status).toBe('DESIGN_REVIEW_REQUIRED');
  expect(result.executable).toBe(false);
  expect(result.canDispatch).toBe(false);
 });
});
