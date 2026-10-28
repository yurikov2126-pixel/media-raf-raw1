import {describe,it,expect} from 'vitest';
import {planEmergencyTransition as plan,emergencyWatchdog} from '../src/lib/radioEmergencyTransitionPlan.js';
const auth={emergencyFeatureEnabled:true,trustedControlPlane:true,operatorAuthorized:true,audioAssetReady:true,outputChainVerified:true,emergencyAudioStopped:true,programResumed:true};
const req=(type,extra={})=>({type,requestId:'incident-001',...extra});
describe('emergency radio handover plans (no real playback)',()=>{
 it('keeps the feature disabled by default',()=>{
   expect(plan(null,req('PREPARE',{targets:['radio']})).reason).toBe('EMERGENCY_FEATURE_DISABLED');
 });
 it('rejects unverified Android notifications even with a prepared asset',()=>{
   expect(plan(null,req('PREPARE',{targets:['radio']}),{...auth,trustedControlPlane:false}).reason).toBe('UNTRUSTED_CONTROL_PLANE');
 });
 it('rejects unauthorized control, invalid targets and missing audio',()=>{
   expect(plan(null,req('PREPARE',{targets:['radio']}),{...auth,operatorAuthorized:false}).accepted).toBe(false);
   expect(plan(null,req('PREPARE',{targets:['other']}),auth).reason).toBe('INVALID_TARGETS');
   expect(plan(null,req('PREPARE',{targets:['radio']}),{...auth,audioAssetReady:false}).reason).toBe('AUDIO_NOT_READY');
 });
 it('models prepare, activate, stop, recover and resume without output side effects',()=>{
   const prepared=plan(null,req('PREPARE',{targets:['radio','speakers']}),auth);
   expect(prepared).toMatchObject({accepted:true,state:'PREPARED',effects:[]});
   const active=plan({phase:'PREPARED',requestId:'incident-001'},req('ACTIVATE'),auth);
   expect(active.effects).toContain('DUCK_EXISTING_AUDIO');
   const stopped=plan({phase:'ACTIVE',requestId:'incident-001'},req('STOP'),auth);
   expect(stopped).toMatchObject({accepted:true,state:'STOPPING'});
   const recovering=plan({phase:'STOPPING',requestId:'incident-001'},req('RECOVER'),auth);
   expect(recovering.effects).toContain('RESTORE_PROGRAM_FROM_CURRENT_TIMELINE');
   expect(plan({phase:'RECOVERING',requestId:'incident-001'},req('RESET'),auth).state).toBe('IDLE');
 });
 it('never lets wrong or duplicate requests hijack an active session',()=>{
   expect(plan({phase:'ACTIVE',requestId:'incident-001'},req('PREPARE',{targets:['radio']}),auth).reason).toBe('BUSY');
   expect(plan({phase:'ACTIVE',requestId:'incident-001'},req('STOP',{requestId:'other'}),auth).reason).toBe('REQUEST_ID_MISMATCH');
   expect(plan({phase:'PREPARED',requestId:'incident-001'},req('ACTIVATE'),{...auth,outputChainVerified:false}).reason).toBe('OUTPUT_CHAIN_NOT_VERIFIED');
 });
 it('watchdog flags stale control and does not automatically restore playout',()=>{
   expect(emergencyWatchdog({phase:'ACTIVE',updatedAtMs:1000},20000).action).toBe('MANUAL_INTERVENTION_REQUIRED');
   expect(emergencyWatchdog({phase:'IDLE'},20000).action).toBe('NONE');
 });
});
