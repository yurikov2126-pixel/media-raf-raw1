import {describe,it,expect} from 'vitest';
import {scheduleLayout,scheduleConflict,scheduleAddDays} from '../components/RadioScheduleBoard.jsx';
const event=(id,start,end)=>({id,startAt:'2026-10-22T'+start+':00+03:00',endAt:'2026-10-22T'+end+':00+03:00'});
describe('Radio 3 timeline layout',()=>{
 it('positions events on a Moscow-local hourly axis',()=>{
  const x=scheduleLayout([event('a','08:00','09:30')],'2026-10-22');
  expect(x[0].top).toBe(480);
  expect(x[0].duration).toBe(90);
 });
 it('puts overlapping events into adjacent lanes and adjacent events into one',()=>{
  const x=scheduleLayout([event('a','08:00','10:00'),event('b','09:00','11:00'),event('c','11:00','12:00')],'2026-10-22');
  expect(x.find(e=>e.id==='a').lanes).toBe(2);
  expect(x.find(e=>e.id==='b').lane).toBe(1);
  expect(x.find(e=>e.id==='c').lanes).toBe(1);
 });
 it('detects overlap without considering touching boundaries a collision',()=>{
  const a=event('a','08:00','09:00'),b=event('b','09:00','10:00');
  expect(scheduleConflict([a,b],a)).toBe(false);
  expect(scheduleConflict([a,event('c','08:59','09:30')],a)).toBe(true);
 });
 it('keeps calendar dates in Moscow across day increment',()=>{
  expect(scheduleAddDays('2026-10-31',1)).toBe('2026-11-01');
 });
});
