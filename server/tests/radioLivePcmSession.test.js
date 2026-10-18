import {describe,it,expect} from 'vitest';
import {LivePcmSessionGate} from '../src/lib/radioLivePcmSession.js';
describe('authenticated live PCM session lifecycle',()=>{
 it('accepts one owner and blocks another while active',()=>{
  const gate=new LivePcmSessionGate({ttlMs:15000});
  const token=gate.start('studio-1',1000);
  expect(gate.valid(token,2000)).toBe(true);
  expect(()=>gate.start('studio-2',2000)).toThrow();
  expect(gate.touch(token,19200,3000)).toBe(true);
  expect(gate.snapshot(4000).receivedBytes).toBe(19200);
 });
 it('rejects missing, stale, and incorrect tokens',()=>{
  const gate=new LivePcmSessionGate({ttlMs:5000});
  const token=gate.start('host',1000);
  expect(gate.valid('wrong',2000)).toBe(false);
  expect(gate.valid(token,6001)).toBe(false);
  expect(gate.touch('wrong',100,2000)).toBe(false);
 });
 it('allows replacement after expiry without leaking previous session',()=>{
  const gate=new LivePcmSessionGate({ttlMs:5000});
  const old=gate.start('first',1000);
  const next=gate.start('second',7000);
  expect(gate.valid(old,7000)).toBe(false);
  expect(gate.valid(next,7000)).toBe(true);
  expect(gate.snapshot(7000).owner).toBe('second');
 });
 it('revokes authorization after explicit stop',()=>{
  const gate=new LivePcmSessionGate();
  const token=gate.start('host');
  expect(gate.stop(token)).toBe(true);
  expect(gate.valid(token)).toBe(false);
 });
});
