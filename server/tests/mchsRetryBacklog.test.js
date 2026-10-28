import {describe,it,expect} from 'vitest';
import {assessMchsRetryBacklog as check} from '../src/lib/mchsRetryBacklog.js';
const now=Date.parse('2026-10-28T15:00:00Z');
const data=(queuedLocal,retryPending,nextRetryAt=null)=>({queuedLocal,retryPending,nextRetryAt,telemetryAt:new Date(now-1000)});
describe('MCHS retry backlog diagnostic is non-authoritative',()=>{
 it('shows clear only for fresh zero counters',()=>expect(check(data(0,0),{nowMs:now}).state).toBe('CLEAR'));
 it('does not flag scheduled retries before due',()=>expect(check(data(2,1,new Date(now+30000)),{nowMs:now}).state).toBe('PENDING'));
 it('warns on significantly overdue scheduled retry',()=>expect(check(data(2,1,new Date(now-360000)),{nowMs:now}).state).toBe('WARNING'));
 it('does not claim healthy queue on stale data',()=>expect(check({...data(0,0),telemetryAt:new Date(now-400000)},{nowMs:now}).state).toBe('UNKNOWN'));
 it('fails closed on inconsistent counters',()=>expect(check(data(0,2),{nowMs:now}).state).toBe('UNKNOWN'));
 it('never activates audio output',()=>expect(check(data(1,1,new Date(now-400000)),{nowMs:now}).playbackEnabled).toBe(false));
});