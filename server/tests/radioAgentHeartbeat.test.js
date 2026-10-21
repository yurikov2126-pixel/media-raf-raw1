import {describe,it,expect} from 'vitest';
import {agentHeartbeatState,summarizeRadioAgents} from '../src/lib/radioAgentHeartbeat.js';
const now=Date.parse('2026-10-22T00:00:00Z');
describe('Windows Radio Agent heartbeat',()=>{
 it('classifies fresh agent and stale agent without claiming playback',()=>{
  expect(agentHeartbeatState({id:'1',name:'Agent A',lastSeenAt:new Date(now-2000),playbackAllowed:true},now).status).toBe('ONLINE');
  expect(agentHeartbeatState({id:'1',name:'Agent A',lastSeenAt:new Date(now-46000)},now).status).toBe('OFFLINE');
 });
 it('keeps never seen and revoked separate',()=>{
  expect(agentHeartbeatState({id:'2',name:'New'},now).status).toBe('NEVER_SEEN');
  expect(agentHeartbeatState({id:'3',revokedAt:new Date(now),lastSeenAt:new Date(now)},now).status).toBe('REVOKED');
 });
 it('summarizes only active registrations',()=>{
  const state=summarizeRadioAgents([{id:'a',lastSeenAt:new Date(now)},{id:'b'},{id:'c',revokedAt:new Date(now)}],now);
  expect(state.registered).toBe(2);expect(state.online).toBe(1);expect(state.neverSeen).toBe(1);
 });
});