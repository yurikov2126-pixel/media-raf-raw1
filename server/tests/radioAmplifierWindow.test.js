import test from 'node:test';
import assert from 'node:assert/strict';
import {amplifierScheduleWindow,ampSeconds} from '../src/lib/radioAmplifierWindow.js';
const slot={startAt:'2026-10-19T10:00:00.000Z',endAt:'2026-10-19T10:30:00.000Z'};
const at=t=>Date.parse('2026-10-19T'+t+'.000Z');
test('amplifier stays ON throughout all schedule boundaries',()=>{
  for(const time of ['09:59:00','09:59:59','10:00:00','10:00:01','10:29:58','10:30:00','10:30:29']){
    assert.equal(amplifierScheduleWindow([slot],at(time),60,30),slot,time);
  }
  for(const time of ['09:58:59','10:30:30']){
    assert.equal(amplifierScheduleWindow([slot],at(time),60,30),null,time);
  }
});
test('back-to-back broadcasts never drop a power request',()=>{
  const next={startAt:'2026-10-19T10:30:00.000Z',endAt:'2026-10-19T11:00:00.000Z'};
  for(const time of ['10:29:59','10:30:00','10:30:30']){
    assert.ok(amplifierScheduleWindow([slot,next],at(time),60,30),time);
  }
});
test('invalid window values use safe defaults',()=>{
  assert.equal(ampSeconds(60,60),60);
  assert.equal(ampSeconds(601,60),60);
  assert.equal(ampSeconds(-1,30),30);
});
