import {describe,it,expect} from 'vitest';
import {mchsIncidentSignals} from '../src/lib/mchsTechnicalIncidents.js';
const now=Date.parse('2026-10-28T17:00:00Z');
const fresh={lastSeenAt:new Date(now-1000),telemetryAt:new Date(now-1000),snapshotOk:true,queuedLocal:0,retryPending:0};
describe('MCHS technical incident signals',()=>{
 it('does not diagnose missing initial heartbeat',()=>expect(mchsIncidentSignals(null,now)).toBe(null));
 it('detects heartbeat outage',()=>expect(mchsIncidentSignals({...fresh,lastSeenAt:new Date(now-200000)},now).HEARTBEAT).toBe('HEARTBEAT_STALE'));
 it('detects SQLite read failure',()=>expect(mchsIncidentSignals({...fresh,snapshotOk:false},now).SNAPSHOT).toBe('ANDROID_SQLITE_READ_FAILED'));
 it('detects old unacknowledged event',()=>expect(mchsIncidentSignals({...fresh,queuedLocal:1,oldestPendingAt:new Date(now-700000)},now).BACKLOG).toBe('OLDEST_PENDING_OVER_10_MINUTES'));
 it('does not resolve missing telemetry',()=>expect(mchsIncidentSignals({...fresh,telemetryAt:new Date(now-200000)},now).RETRY).toBe(undefined));
 it('has no signals when healthy',()=>expect(Object.values(mchsIncidentSignals(fresh,now)).every(x=>!x)).toBe(true));
});