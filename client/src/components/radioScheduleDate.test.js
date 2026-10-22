import {describe,it,expect} from 'vitest';
import {scheduleDayKey} from './RadioScheduleBoard.jsx';
describe('schedule date safety',()=>{
 it('does not crash when schedule start is missing or malformed',()=>{
  expect(scheduleDayKey(null)).toBe(null);
  expect(scheduleDayKey(undefined)).toBe(null);
  expect(scheduleDayKey('broken')).toBe(null);
 });
 it('formats valid broadcast time as a Moscow date',()=>{
  expect(scheduleDayKey('2026-10-22T21:30:00Z')).toBe('2026-10-23');
 });
});
