import {describe,it,expect} from 'vitest';
import {planPrivatePcmSchedule} from '../components/radioPrivatePcmClock.js';
describe('private PCM browser headphone playout',()=>{
 it('keeps continuous audio when frames arrive on time',()=>{
  expect(planPrivatePcmSchedule({nextTime:12.3,currentTime:12})).toEqual({time:12.3,rebuffered:false});
 });
 it('re-primes after network jitter rather than throwing PLAYBACK_UNDERRUN',()=>{
  expect(planPrivatePcmSchedule({nextTime:12.01,currentTime:12})).toEqual({time:12.45,rebuffered:true});
 });
 it('bounds late backlog to prevent growing end-to-end delay',()=>{
  expect(planPrivatePcmSchedule({nextTime:14,currentTime:12})).toEqual({time:12.45,rebuffered:true});
 });
 it('rejects invalid AudioContext clock data',()=>{
  expect(()=>planPrivatePcmSchedule({nextTime:NaN,currentTime:1})).toThrow(TypeError);
 });
});
