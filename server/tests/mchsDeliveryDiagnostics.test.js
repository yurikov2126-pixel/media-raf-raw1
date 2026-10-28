import {describe,it,expect} from 'vitest';
import {summarizeMchsDelivery as check} from '../src/lib/mchsDeliveryDiagnostics.js';
const now=Date.parse('2026-10-28T12:00:00Z');
describe('MCHS delivery monitoring does not infer absent threats',()=>{
 it('marks a fresh heartbeat, without claiming complete push delivery',()=>{
  const x=check({health:{lastSeenAt:new Date(now-20000),listener:'OK',push:'OK'},nowMs:now});
  expect(x.connection).toBe('HEARTBEAT_RECENT');
  expect(x.deliveryCompleteness).toBe('UNKNOWN');
  expect(x.noRecentEventsIsFailure).toBe(false);
 });
 it('flags stale heartbeat independent of notifications',()=>{
  expect(check({health:{lastSeenAt:new Date(now-300000)},nowMs:now}).connection).toBe('HEARTBEAT_STALE');
 });
 it('calculates recorded event time lag, but no guaranteed transport latency',()=>{
  const x=check({lastEvent:{occurredAt:new Date(now-10000),receivedAt:new Date(now)},nowMs:now});
  expect(x.lastEventLagMs).toBe(10000);
  expect(x.officialVerified).toBe(false);
 });
 it('does not interpret missing events as a failure',()=>{
  const x=check({nowMs:now,pending:0});
  expect(x.lastEventLagMs).toBeNull();
  expect(x.playbackEnabled).toBe(false);
  expect(x.missingEventsKnown).toBe(false);
 });
});