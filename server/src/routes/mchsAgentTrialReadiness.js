import {Router} from 'express';
import {auth,requireRole} from '../middleware/auth.js';
import {prisma} from '../lib/prisma.js';
import {MCHS_DISPATCH_PROTOCOL_KEY,normalizeMchsDispatchProtocol}
 from '../lib/mchsDispatchProtocol.js';
import {assessMchsAgentTrialStart} from '../lib/mchsAgentTrialStartPreflight.js';

const router=Router();
const settingsKey=id=>'mchs_agent_device_commands_v1_'+id;

/** Read-only diagnosis: NEVER queues START, toggles HALT, or controls radio. */
router.get('/mchs-agent-trial-start-readiness',auth,requireRole('ADMIN'),async(req,res,next)=>{
 try{
  res.setHeader('Cache-Control','no-store');
  const deviceId=process.env.MCHS_AGENT_LAB_DEVICE_ID;
  const trialEnabled=process.env.MCHS_ISOLATED_AGENT_TRIAL_START_ENABLED==='true';
  const [dispatchRow,deviceRow,event]=await Promise.all([
   prisma.setting.findUnique({where:{key:MCHS_DISPATCH_PROTOCOL_KEY}}),
   deviceId?prisma.setting.findUnique({where:{key:settingsKey(deviceId)}}):null,
   prisma.safetyMchsEvent.findFirst({
    where:{source:'MCHS_ANDROID',verified:true},
    orderBy:{receivedAt:'desc'},
    select:{id:true,source:true,verified:true,occurredAt:true,title:true,body:true}
   })
  ]);
  let dispatchRaw,deviceState;
  try{dispatchRaw=JSON.parse(dispatchRow?.value||'null');}catch{dispatchRaw=null;}
  try{deviceState=JSON.parse(deviceRow?.value||'null');}catch{deviceState=null;}
  const dispatch=normalizeMchsDispatchProtocol(dispatchRaw);
  const reasons=[];
  if(!deviceId)reasons.push('DEVICE_NOT_BOUND');
  if(!trialEnabled)reasons.push('TRIAL_DISABLED');
  if(dispatch.halted)reasons.push('DISPATCH_HALTED');
  if(deviceState?.halted!==false)reasons.push('DEVICE_LEDGER_HALTED');
  if(deviceState?.pending)reasons.push('COMMAND_PENDING');
  // Physical isolation and local WAV digest are not remotely observable.
  // A GET must never turn operator-provided claims into authorization.
  reasons.push('LOCAL_OUTPUT_ISOLATION_NOT_ATTESTED');
  reasons.push('LOCAL_WAV_DIGEST_NOT_BOUND');
  if(!event)reasons.push('VERIFIED_ANDROID_EVENT_MISSING');
  else{
   const age=Date.now()-Date.parse(event.occurredAt||'');
   if(!Number.isFinite(age)||age<0||age>120000)
    reasons.push('ANDROID_EVENT_NOT_FRESH');
  }
  res.json({
   mode:'READ_ONLY_HEADPHONES_PREFLIGHT',ready:false,
   startQueued:false,automaticPlaybackEnabled:false,
   publicStreamAllowed:false,amplifierAllowed:false,
   deviceBound:!!deviceId,trialEnabled,
   dispatchHalted:dispatch.halted,deviceLedgerHalted:deviceState?.halted!==false,
   pendingAction:deviceState?.pending?.action||null,
   lastVerifiedEventId:event?.id||null,reasons,
   // This helper is deliberately NOT invoked with manufactured approval:
   // further admission requires a real request + device-local isolation.
   eventPreflightAvailable:typeof assessMchsAgentTrialStart==='function'
  });
 }catch(error){next(error);}
});
export default router;
