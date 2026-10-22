import {describe,it,expect} from 'vitest';
import {previewScheduleChange} from './radioSchedulePreview.js';
const entries=[{id:'a',startAt:'2026-10-23T09:00:00+03:00',endAt:'2026-10-23T10:00:00+03:00',title:'Утро'}];
describe('schedule preflight preview',()=>{
 it('detects overlap and ignores the edited item',()=>{
  expect(previewScheduleChange(entries,null,'2026-10-23T09:30',30).conflicts).toHaveLength(1);
  expect(previewScheduleChange(entries,entries[0],'2026-10-23T09:30',30).conflicts).toHaveLength(0);
 });
 it('allows touching edges without conflict',()=>{
  expect(previewScheduleChange(entries,null,'2026-10-23T10:00',30).conflicts).toHaveLength(0);
 });
 it('rejects malformed start and excessive duration',()=>{
  expect(previewScheduleChange(entries,null,'abc',30).valid).toBe(false);
  expect(previewScheduleChange(entries,null,'2026-10-23T11:00',999).valid).toBe(false);
 });
});