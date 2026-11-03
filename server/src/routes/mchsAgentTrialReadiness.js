import {Router} from 'express';
import {auth,requireRole} from '../middleware/auth.js';
import {prisma} from '../lib/prisma.js';
import {MCHS_DISPATCH_PROTOCOL_KEY,normalizeMchsDispatchProtocol}
 from '../lib/mchsDispatchProtocol.js';
import {summarizeMchsTrialStartReadiness} from '../lib/mchsAgentTrialReadiness.js';

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
  res.json(summarizeMchsTrialStartReadiness({
   deviceBound:!!deviceId,trialEnabled,
   dispatchHalted:dispatch.halted,deviceLedgerHalted:deviceState?.halted!==false,
   pendingAction:deviceState?.pending?.action||null,event
  }));
 }catch(error){next(error);}
});
export default router;
