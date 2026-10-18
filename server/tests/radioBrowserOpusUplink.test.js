import {describe,it,expect} from 'vitest';
import {BrowserOpusUplink} from '../src/lib/radioBrowserOpusUplink.js';
describe('isolated browser Opus uplink',()=>{
 it('accepts ordered bounded binary chunks from an active session',()=>{
  const q=new BrowserOpusUplink();q.start(1000);
  expect(q.receive(Buffer.from([1,2]),0,1200).accepted).toBe(true);
  expect(q.receive(Buffer.from([3,4]),1,1400).accepted).toBe(true);
  expect(q.snapshot(1400).acceptedBytes).toBe(4);
 });
 it('rejects out-of-order, duplicate and oversized chunks',()=>{
  const q=new BrowserOpusUplink({maxChunkBytes:8});q.start(1000);
  expect(q.receive(Buffer.alloc(9),0,1100).reason).toBe('INVALID_CHUNK');
  expect(q.receive(Buffer.alloc(4),1,1100).reason).toBe('OUT_OF_ORDER');
  expect(q.receive(Buffer.alloc(4),0,1100).accepted).toBe(true);
  expect(q.receive(Buffer.alloc(4),0,1200).reason).toBe('OUT_OF_ORDER');
 });
 it('expires after inactivity and clears state on stop',()=>{
  const q=new BrowserOpusUplink({timeoutMs:1000});q.start(1000);
  expect(q.receive(Buffer.alloc(4),0,2001).reason).toBe('STALE_SESSION');
  q.reset();
  expect(q.snapshot(2001).active).toBe(false);
 });
});
