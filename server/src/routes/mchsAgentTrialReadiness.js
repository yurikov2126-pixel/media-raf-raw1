import {Router} from 'express';
import {createHash} from 'node:crypto';
import {parseRadioAgentBearerToken} from '../lib/radioAgentBearerToken.js';
import {normalizeMchsAgentReadiness,readMchsAgentReadiness} from '../lib/mchsAgentIsolatedReadiness.js';
import {auth,requireRole} from '../middleware/auth.js';
import {prisma} from '../lib/prisma.js';
import {MCHS_DISPATCH_PROTOCOL_KEY,normalizeMchsDispatchProtocol}
 from '../lib/mchsDispatchProtocol.js';
import {summarizeMchsTrialStartReadiness} from '../lib/mchsAgentTrialReadiness.js';

const router=Router();
const settingsKey=id=>'mchs_agent_device_commands_v1_'+id;
const readyKey=id=>'mchs_agent_isolated_readiness_v1_'+id;

// Device-authenticated heartbeat, *only* for the bound headphone pilot.
// This does not approve START, change HALT, or attest physical speaker wiring.
router.post('/agent/mchs-isolated-readiness',async(req,res,next)=>{
 try{
  res.setHeader('Cache-Control','no-store');
  const token=parseRadioAgentBearerToken(req.headers.authorization);
  if(!token||!/^rr_[a-f0-9]{64}$/.test(token))
   return res.status(401).json({error:'DEVICE_TOKEN_REQUIRED'});
  const device=await prisma.radioDevice.findUnique({where:{
   tokenHash:createHash('sha256').update(token).digest('hex')}});
  if(!device||device.revokedAt)return res.status(401).json({error:'DEVICE_UNAUTHORIZED'});
  if(!process.env.MCHS_AGENT_LAB_DEVICE_ID||
     device.id!==process.env.MCHS_AGENT_LAB_DEVICE_ID)
   return res.status(403).json({error:'DEVICE_NOT_BOUND'});
  const result=normalizeMchsAgentReadiness(req.body);
  if(!result.ok)return res.status(400).json({error:result.reason});
  const key=readyKey(device.id);
  const value=JSON.stringify({...result.value,receivedAt:new Date().toISOString()});
  await prisma.setting.upsert({where:{key},create:{key,value},update:{value}});
  res.json({accepted:true,observationOnly:true,physicalPaVerified:false,
   publicPlaybackAuthorized:false});
 }catch(error){next(error);}
});

/** Read-only diagnosis: NEVER queues START, toggles HALT, or controls radio. */
router.get('/mchs-agent-trial-start-readiness',auth,requireRole('ADMIN'),async(req,res,next)=>{
 try{
  res.setHeader('Cache-Control','no-store');
  const deviceId=process.env.MCHS_AGENT_LAB_DEVICE_ID;
  const trialEnabled=process.env.MCHS_ISOLATED_AGENT_TRIAL_START_ENABLED==='true';
  const [dispatchRow,deviceRow,readyRow,event]=await Promise.all([
   prisma.setting.findUnique({where:{key:MCHS_DISPATCH_PROTOCOL_KEY}}),
   deviceId?prisma.setting.findUnique({where:{key:settingsKey(deviceId)}}):null,
   deviceId?prisma.setting.findUnique({where:{key:readyKey(deviceId)}}):null,
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
  const agentReadiness=readMchsAgentReadiness(readyRow?.value);
  res.json({...summarizeMchsTrialStartReadiness({
   deviceBound:!!deviceId,trialEnabled,
   dispatchHalted:dispatch.halted,deviceLedgerHalted:deviceState?.halted!==false,
   pendingAction:deviceState?.pending?.action||null,event
  }),isolatedAndroidAutoTrialEnabled:
   process.env.MCHS_ISOLATED_ANDROID_AUTO_TRIAL_ENABLED==='true',
   isolatedAndroidAutoTrialOnly:true,
   androidChannelAllowlistConfigured:!!(process.env.MCHS_MISSILE_TRUSTED_CHANNEL_IDS||'').trim(),
   agentReadiness:agentReadiness?{
   fresh:true,mode:agentReadiness.mode,
   centralPacketsConfirmed:agentReadiness.centralPacketsConfirmed,
   operatorIsolationAttested:agentReadiness.operatorIsolationAttested,
   localWavHashesReported:true,receivedAt:agentReadiness.receivedAt,
   physicalPaVerified:false
  }:null});
 }catch(error){next(error);}
});
export default router;
