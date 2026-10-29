import {describe,it,expect} from 'vitest';
import {createWorkerMchsLabSession} from '../src/lib/mchsWorkerLabSession.js';
describe('MCHS isolated server-side session',()=>{
 it('enforces ordering and hard stop',()=>{
  const s=createWorkerMchsLabSession();
  expect(s.command('INTERRUPT').ok).toBe(false);
  expect(s.command('START').phase).toBe('PROGRAM');
  expect(s.command('INTERRUPT').phase).toBe('ALERT');
  expect(s.command('RESUME').phase).toBe('PROGRAM');
  expect(s.command('STOP').phase).toBe('IDLE');
  expect(s.command('RESUME').ok).toBe(false);
 });
 it('expires idle without further command',()=>{
  let t=100;
  const s=createWorkerMchsLabSession({now:()=>t,ttlMs:1000});
  s.command('START');t+=1001;
  expect(s.status().phase).toBe('IDLE');
 });
 it('never returns a station output target',()=>{
  const s=createWorkerMchsLabSession();
  expect(s.command('START').output).toBe('ISOLATED_LAB_ONLY');
 });
});