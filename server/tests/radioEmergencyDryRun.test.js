import {describe,it,expect} from 'vitest';
import {createEmergencyDryRun} from '../src/lib/radioEmergencyDryRun.js';

const session='dry-run-001';
const context={trustedControlPlane:true,operatorAuthorized:true,audioAssetReady:true,outputChainVerified:true,emergencyAudioStopped:true,programResumed:true};
const request=(type,extra={})=>({type,requestId:session,...extra});
const start=(source)=>{
 const sim=createEmergencyDryRun({now:()=>1750000000000});
 expect(sim.run(request('PREPARE',{targets:['radio','speakers']}),{...context,source}).state).toBe('PREPARED');
 return sim;
};
describe('radio emergency simulation isolated from PCM',()=>{
 for(const source of ['AUTO_DJ','SCHEDULE','LIVE','MANUAL_PLAYLIST','AUTO_PLAYLIST']){
  it('simulates ordered handover and timeline recovery for '+source,()=>{
   const sim=start(source);
   const activated=sim.run(request('ACTIVATE'),{...context,source});
   expect(activated).toMatchObject({accepted:true,state:'ACTIVE',source,simulationOnly:true,playbackChanged:false});
   expect(activated.effects).toContain('DUCK_EXISTING_AUDIO');
   expect(sim.run(request('STOP'),{...context,source}).state).toBe('STOPPING');
   expect(sim.run(request('RECOVER'),{...context,source}).effects).toContain('RESTORE_PROGRAM_FROM_CURRENT_TIMELINE');
   expect(sim.run(request('RESET'),{...context,source}).state).toBe('IDLE');
   expect(sim.snapshot()).toMatchObject({mode:'DRY_RUN_ONLY',state:{phase:'IDLE',requestId:null}});
   expect(sim.snapshot().history).toHaveLength(5);
  });
 }
 it('blocks simulated notification without trusted control and never alters state',()=>{
  const sim=createEmergencyDryRun();
  expect(sim.run(request('PREPARE',{targets:['radio']}),{source:'LIVE'}).reason).toBe('UNTRUSTED_CONTROL_PLANE');
  expect(sim.snapshot().state.phase).toBe('IDLE');
 });
 it('rejects conflicting requests and writes a bounded diagnostic record',()=>{
  const sim=createEmergencyDryRun({maxEntries:2});
  sim.run(request('PREPARE',{targets:['radio']}),context);
  expect(sim.run(request('PREPARE',{targets:['radio']}),context).reason).toBe('BUSY');
  expect(sim.run(request('STOP',{requestId:'incorrect'}),context).reason).toBe('REQUEST_ID_MISMATCH');
  expect(sim.snapshot().history).toHaveLength(2);
  expect(sim.snapshot().state.phase).toBe('PREPARED');
 });
 it('does not automatically resume a stale emergency state',()=>{
  let timestamp=1000;
  const sim=createEmergencyDryRun({now:()=>timestamp});
  sim.run(request('PREPARE',{targets:['radio']}),context);
  timestamp=20000;
  expect(sim.snapshot().watchdog.action).toBe('MANUAL_INTERVENTION_REQUIRED');
  expect(sim.snapshot().state.phase).toBe('PREPARED');
 });
});