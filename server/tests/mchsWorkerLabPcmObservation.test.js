import {describe,it,expect} from 'vitest';
import {createWorkerMchsLabSession} from '../src/lib/mchsWorkerLabSession.js';
describe('isolated MCHS Worker PCM switch observation',()=>{
 it('measures only latest valid command to first server PCM tick',()=>{
  let now=1000;const session=createWorkerMchsLabSession({now:()=>now});
  expect(session.status().pcmObservation).toBeNull();
  expect(session.command('START').phase).toBe('PROGRAM');
  now+=22;session.observePcmTick(1);
  expect(session.status().pcmObservation).toEqual({revision:1,phase:'PROGRAM',workerCommandToPcmTickMs:22});
  now+=100;session.observePcmTick(1);
  expect(session.status().pcmObservation.workerCommandToPcmTickMs).toBe(22);
  session.command('INTERRUPT');
  expect(session.status().pcmObservation).toBeNull();
  session.observePcmTick(1);expect(session.status().pcmObservation).toBeNull();
  now+=18;session.observePcmTick(2);
  expect(session.status().pcmObservation.workerCommandToPcmTickMs).toBe(18);
 });
 it('STOP measures a silence tick; invalid transitions do not change revision',()=>{
  let now=30;const session=createWorkerMchsLabSession({now:()=>now});
  expect(session.command('RESUME').ok).toBe(false);
  expect(session.status().revision).toBe(0);
  session.command('START');session.command('STOP');
  now+=5;session.observePcmTick(2);
  expect(session.status().pcmObservation).toEqual({revision:2,phase:'IDLE',workerCommandToPcmTickMs:5});
 });
 it('no monitor means no PCM observation, and expiry remains safe',()=>{
  let now=0;const session=createWorkerMchsLabSession({now:()=>now,ttlMs:120});
  session.command('START');now=121;
  expect(session.status().phase).toBe('IDLE');
  expect(session.status().pcmObservation).toBeNull();
 });
});