import {describe,it,expect} from 'vitest';
import {summarizePlayout,exportPlayoutCsv} from '../src/lib/radioStationInsights.js';
const now=Date.parse('2026-10-18T18:00:00Z');
const events=[
{id:'a',name:'Song A',mode:'AUTO_DJ',startedAt:'2026-10-18T17:55:00Z',generatedMs:10000},
{id:'b',name:'Song B',mode:'AUTO_DJ',startedAt:'2026-10-18T17:56:00Z',generatedMs:1500,mixed:true},
{id:'a',name:'Song A',mode:'SCHEDULED',startedAt:'2026-10-18T10:00:00Z',generatedMs:5000},
];
describe('radio station operations',()=>{
 it('summarizes windows and avoids counting mixed sources twice',()=>{
  const result=summarizePlayout(events,now,1);
  expect(result.events).toBe(2);
  expect(result.mixedEvents).toBe(1);
  expect(result.generatedMs).toBe(10000);
  expect(result.uniqueTracks).toBe(2);
 });
 it('shows a different time window without filtering history permanently',()=>{
  expect(summarizePlayout(events,now,24).scheduled).toBe(1);
  expect(events).toHaveLength(3);
 });
 it('escapes CSV quoting and spreadsheet formulas',()=>{
  const csv=exportPlayoutCsv([{...events[0],name:'=SUM(1,1) "x"'}]);
  expect(csv).toContain('""x""');
  expect(csv).toContain("'=SUM");
 });
});
