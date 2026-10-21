import {describe,it,expect} from 'vitest';
import {normalizeRadioLayout,moveRadioWidget,RADIO_PRESETS} from './radioWorkspaceLayout.js';
describe('radio OS workspace',()=>{
 it('normalizes stale or malformed persisted settings',()=>{
  const result=normalizeRadioLayout({order:['queue','ghost','queue'],hidden:['onair','actions','missing'],wide:['diagnostics','other']});
  expect(result.order[0]).toBe('queue');expect(new Set(result.order).size).toBe(5);
  expect(result.hidden).toEqual(['actions']);expect(result.wide).toEqual(['diagnostics']);
 });
 it('moves the dragged widget before the target',()=>{
  const moved=moveRadioWidget(RADIO_PRESETS.air,'actions','queue');
  expect(moved.order.indexOf('actions')).toBe(moved.order.indexOf('queue')-1);
 });
 it('defines distinct operator presets',()=>{
  expect(RADIO_PRESETS.monitoring.wide).toContain('diagnostics');
  expect(RADIO_PRESETS.editor.hidden).toContain('diagnostics');
 });
});