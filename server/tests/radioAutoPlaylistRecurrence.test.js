import {describe,it,expect} from 'vitest';
import {validateRadioAutoPlaylistRule,upcomingMoscowDates} from '../src/lib/radioAutoPlaylistRecurrence.js';
describe('radio recurring AutoPlaylist rules',()=>{
 it('accepts weekdays and Moscow minute-of-day',()=>{
  expect(validateRadioAutoPlaylistRule({weekdays:[1,3,5],startMinute:480,enabled:true}))
   .toEqual({weekdays:[1,3,5],startMinute:480,enabled:true});
 });
 it('rejects duplicate weekdays and invalid clock times',()=>{
  expect(()=>validateRadioAutoPlaylistRule({weekdays:[1,1],startMinute:480})).toThrow();
  expect(()=>validateRadioAutoPlaylistRule({weekdays:[1],startMinute:1440})).toThrow();
 });
 it('evaluates dates and weekdays in UTC+3, not API-server timezone',()=>{
  const dates=upcomingMoscowDates(new Date('2026-10-21T22:30:00Z'),2);
  expect(dates.map(x=>x.localDate)).toEqual(['2026-10-22','2026-10-23']);
  expect(dates.map(x=>x.day)).toEqual([4,5]);
 });
});
