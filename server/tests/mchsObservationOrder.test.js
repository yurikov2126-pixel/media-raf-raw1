import {describe,it,expect} from 'vitest';
import {inspectMchsObservationOrder as inspect} from '../src/lib/mchsObservationOrder.js';
const row=(id,title,time)=>({id,sourceEventId:id,source:'MCHS_ANDROID',title,body:'',occurredAt:time});
describe('MCHS observation order is non-authoritative',()=>{
 const t1='2026-10-28T08:00:00Z',t2='2026-10-28T08:01:00Z';
 it('associates all-clear with earlier danger for same family only',()=>{
  const r=inspect([row('2','ОТБОЙ опасности атаки БПЛА',t2),row('1','ОПАСНОСТЬ АТАКИ БПЛА',t1)]);
  expect(r.map(x=>x.diagnosis)).toEqual(['DANGER_OBSERVED','MATCHED_ALL_CLEAR']);
  expect(r.every(x=>x.officialState==='UNKNOWN')).toBe(true);
 });
 it('flags unmatched missile all-clear',()=>{
  expect(inspect([row('3','ОТБОЙ РАКЕТНОЙ ОПАСНОСТИ',t2)])[0].diagnosis).toBe('UNMATCHED_ALL_CLEAR');
 });
 it('detects duplicate IDs without changing alert state',()=>{
  const r=inspect([row('1','РАКЕТНАЯ ОПАСНОСТЬ',t1),row('1','РАКЕТНАЯ ОПАСНОСТЬ',t2)]);
  expect(r[1].diagnosis).toBe('DUPLICATE_OR_MISSING_ID');
 });
 it('keeps UAV and missile families separate',()=>{
  const r=inspect([row('1','РАКЕТНАЯ ОПАСНОСТЬ',t1),row('2','ОТБОЙ опасности атаки БПЛА',t2)]);
  expect(r[1].diagnosis).toBe('UNMATCHED_ALL_CLEAR');
 });
 it('never enables playback on correct matched pairs',()=>{
  const r=inspect([row('1','ОПАСНОСТЬ АТАКИ БПЛА',t1),row('2','ОТБОЙ опасности атаки БПЛА',t2)]);
  expect(r.every(x=>x.playbackEnabled===false&&x.sourceVerified===false)).toBe(true);
 });
});