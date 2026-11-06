import {fetchIsolatedHeadphonesSelfTest} from '../lib/mchsHeadphonesSelfTestRelay.js';
import {selectMchsAgentCommand} from '../lib/mchsAgentCommandSelection.js';
import {advanceIsolatedAndroidAutoFeed} from '../lib/mchsIsolatedAndroidAutoFeed.js';
import {stageSyntheticHeadphonesCycle,advanceSyntheticHeadphonesCycle} from '../lib/mchsSyntheticHeadphonesCycle.js';
import {readMchsAgentReadiness} from '../lib/mchsAgentIsolatedReadiness.js';
import {advanceMchsDeviceCommand} from '../lib/mchsDeviceCommandLedger.js';
import {workerMchsSessionRequest} from '../lib/mchsWorkerLabSessionProxy.js';
import http from 'node:http';
import { Router } from 'express';
import {summarizeRadioAgents} from '../lib/radioAgentHeartbeat.js';
import {normalizeMchsAgentPlaybackReport} from '../lib/mchsAgentPlaybackReport.js';
import {normalizeMchsEventExecutionObservation} from '../lib/mchsEventExecutionObservation.js';
import {appendMchsExecutionObservation,readMchsExecutionObservationHistory,mergeLegacyMchsExecutionObservation} from '../lib/mchsExecutionObservationHistory.js';
import {validateAudioReport,audioHealth} from '../lib/radioAgentAudioHealth.js';
import { validLanIpv4 } from '../lib/radioEsp32Address.js';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { prisma } from '../lib/prisma.js';
import { resolveRadioCursor } from '../lib/radioTimeline.js';
import { DEFAULT_AMP_PRE_SECONDS, DEFAULT_AMP_POST_SECONDS, ampSeconds, amplifierScheduleWindow } from '../lib/radioAmplifierWindow.js';
import { readAutoDjSettings, selectAutoDjAssets, autoDjCursor } from '../lib/radioAutoDj.js';
import { servePilotStream, stationStreamHealth, stationSnapshot } from '../lib/radioStreamPilot.js';
import { streamWorker, workerHealth } from '../lib/radioWorkerProxy.js';
import { workerRequest } from '../lib/radioLiveOpusGateway.js';
import { auth, requireRole } from '../middleware/auth.js';

import {MCHS_DISPATCH_PROTOCOL_KEY,normalizeMchsDispatchProtocol} from '../lib/mchsDispatchProtocol.js';
import {validateMchsTrialStopEvidence} from '../lib/mchsTrialStopEvidence.js';
import {requestMchsStationSession} from '../lib/mchsStationWorkerTransport.js';
import {assessMchsAmplifierDemand} from '../lib/mchsAmplifierDemand.js';
const router = Router();
const assetsRoot = path.resolve(process.env.RADIO_ASSET_DIR || 'private/radio-audio');
const digest = value => createHash('sha256').update(value).digest('hex');
const admin = [auth, requireRole('ADMIN')];
const safe = fn => (req,res,next) => Promise.resolve(fn(req,res)).catch(next);

async function deviceAuth(req,res,next) {
  try {
    const token = /^Bearer (\S+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token || !/^rr_[a-f0-9]{64}$/.test(token)) return res.status(401).json({ error: 'Токен устройства отсутствует' });
    const device = await prisma.radioDevice.findUnique({ where: { tokenHash: digest(token) } });
    if (!device || device.revokedAt) return res.status(401).json({ error: 'Устройство отключено' });
    req.radioDevice = device;
    return next();
  } catch(e) { next(e); }
}

// ESP32 inventory is configuration only; never exposes a mains relay control.
const ESP32_REGISTRY_KEY='radio_esp32_registry_v1';
const ESP32_STATUS_KEY='radio_esp32_status_v1';
import {MCHS_ESP32_TRANSITIONS_KEY,recordEsp32Transition} from '../lib/mchsEsp32TransitionEvidence.js';
import {mergeAgentPowerEvidence} from '../lib/mchsAgentPowerCorrelation.js';
import {buildEsp32ReportSnapshot} from '../lib/mchsEsp32ReportSnapshot.js';
async function readEsp32Registry(){
  const row=await prisma.setting.findUnique({where:{key:ESP32_REGISTRY_KEY}});
  try{
    const value=JSON.parse(row?.value||'[]');
    return Array.isArray(value)?value.filter(d=>d&&typeof d.id==='string').slice(0,50):[];
  }catch{return [];}
}
async function readEsp32Status(){
  const row=await prisma.setting.findUnique({where:{key:ESP32_STATUS_KEY}});
  try{
    const value=JSON.parse(row?.value||'{}');
    return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  }catch{return {};}
}
router.get('/esp32',...admin,safe(async(_req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const [devices,status]=await Promise.all([readEsp32Registry(),readEsp32Status()]);
  const now=Date.now();
  res.json({devices:devices.map(d=>{
    const t=status[d.id];
    const fresh=!!t&&Number.isFinite(Date.parse(t.observedAt))&&now-Date.parse(t.observedAt)<12000&&now>=Date.parse(t.observedAt);
    return {...d,telemetry:fresh?{...t,online:t.heartbeatFresh===true}:null,
      connectivity:fresh&&t.heartbeatFresh===true?'ONLINE':'OFFLINE'};
  })});
}));
router.post('/agent/esp32-status',deviceAuth,safe(async(req,res)=>{
  const ip=req.body?.ip;
  const status=req.body?.status;
  if(!validLanIpv4(ip)||!status||typeof status!=='object'||Array.isArray(status))
    return res.status(400).json({error:'Некорректная телеметрия ESP32'});
  const devices=await readEsp32Registry();
  const device=devices.find(d=>d.ip===ip);
  if(!device)return res.status(404).json({error:'ESP32 не зарегистрирован'});
  if(status.device!=='MEDIA_RAF_RAW_ESP32'||!['SAFE_PILOT','POWER_CONTROL_V1'].includes(status.mode)||
    typeof status.relayOutputEnabled!=='boolean'||
    status.relayGpio!==13||typeof status.heartbeatFresh!=='boolean'||
    !['CENTRAL','LOCAL_RESERVE','STOPPED','DISCONNECTED'].includes(status.agentMode))
    return res.status(400).json({error:'Ожидается безопасная телеметрия SAFE_PILOT'});
  // A single database transaction guarantees that the last ESP32 snapshot,
  // firmware transition ring and sanitized Agent decisions refer to one report.
  // Before this change, an overlapping report could overwrite a newer snapshot
  // after the journal transaction had already committed.
  await prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581454)`;
    const [snapRow,historyRow]=await Promise.all([
      tx.setting.findUnique({where:{key:ESP32_STATUS_KEY}}),
      tx.setting.findUnique({where:{key:MCHS_ESP32_TRANSITIONS_KEY}})
    ]);
    let snapshots;try{snapshots=JSON.parse(snapRow?.value||'{}');}catch{}
    if(!snapshots||typeof snapshots!=='object'||Array.isArray(snapshots))snapshots={};
    let saved;try{saved=JSON.parse(historyRow?.value||'null');}catch{}
    const observedAt=new Date().toISOString();
    const outcome=recordEsp32Transition(saved,{deviceId:device.id,
      reporterId:req.radioDevice.id,observedAt,status});
    if(outcome.reason==='OLD_OR_DUPLICATE_OBSERVATION')
      return; // No stale snapshot and no duplicate transition history.
    const agent=mergeAgentPowerEvidence(outcome.state,{deviceId:device.id,
      reporterId:req.radioDevice.id,observations:req.body?.agentPowerEvidence||[]});
    snapshots[device.id]=buildEsp32ReportSnapshot(status,{
      observedAt,reporterId:req.radioDevice.id,
      agentPowerEvidence:req.body?.agentPowerEvidence
    });

    await tx.setting.upsert({where:{key:ESP32_STATUS_KEY},
      create:{key:ESP32_STATUS_KEY,value:JSON.stringify(snapshots)},
      update:{value:JSON.stringify(snapshots)}});
    await tx.setting.upsert({where:{key:MCHS_ESP32_TRANSITIONS_KEY},
      create:{key:MCHS_ESP32_TRANSITIONS_KEY,value:JSON.stringify(agent.state)},
      update:{value:JSON.stringify(agent.state)}});
    if(outcome.added.length||agent.added.length)
      console.info('MCHS_ESP32_TRANSITION',JSON.stringify({
        deviceId:device.id,kinds:[...outcome.added,...agent.added].map(x=>x.kind)}));
  });
  res.json({ok:true});
}));
// Logical amplifier control plane; SAFE_PILOT does not actuate mains GPIO.
const AMP_KEY='radio_amplifier_policy_v1';
async function ampState(){
  const row=await prisma.setting.findUnique({where:{key:AMP_KEY}});
  try{
    const v=JSON.parse(row?.value||'{}');
    return {mode:v.mode==='MANUAL'?'MANUAL':'AUTO',manualOn:v.manualOn===true,
      emergencyOff:v.emergencyOff===true,preSeconds:ampSeconds(v.preSeconds,DEFAULT_AMP_PRE_SECONDS),
      postSeconds:ampSeconds(v.postSeconds,DEFAULT_AMP_POST_SECONDS),updatedAt:v.updatedAt||null};
  }catch{return {mode:'AUTO',manualOn:false,emergencyOff:false,preSeconds:DEFAULT_AMP_PRE_SECONDS,
      postSeconds:DEFAULT_AMP_POST_SECONDS,updatedAt:null};}
}
async function ampDecision(){
  const policy=await ampState();
  const now=Date.now();
  // Query a superset of the configurable window; then apply one consistent
  // [start - pre, end + post) predicate to avoid ON→OFF→ON at slot start.
  const [esp32,devices,autoDj,slots,station]=await Promise.all([
    readEsp32Status(),readEsp32Registry(),readAutoDjSettings(),
    prisma.radioScheduleSlot.findMany({where:{
      endAt:{gt:new Date(now-policy.postSeconds*1000)},
      startAt:{lte:new Date(now+policy.preSeconds*1000)},
      playlist:{status:'APPROVED'}},
      orderBy:{startAt:'asc'},select:{id:true,startAt:true,endAt:true},take:20}),
    requestMchsStationSession({action:'STATUS'},{timeoutMs:900})
      .catch(()=>({ok:false,reason:'WORKER_UNREACHABLE'}))
  ]);
  const nextSlot=amplifierScheduleWindow(slots,now,policy.preSeconds,policy.postSeconds);
  const device=devices[0]||null,telemetry=device?esp32[device.id]:null;
  const fresh=telemetry&&Date.now()-Date.parse(telemetry.observedAt)<12000&&Date.now()>=Date.parse(telemetry.observedAt);
  const connected=!!fresh&&telemetry.heartbeatFresh===true;
  const alert=assessMchsAmplifierDemand(station);
  const alertPower=policy.mode==='AUTO'&&alert.active;
  const requested=policy.emergencyOff?false:policy.mode==='MANUAL'?policy.manualOn:
    Boolean(alertPower||nextSlot||autoDj.enabled);
  return {policy,requested,mchsPcmActive:alert.active,
    mchsPreRollActive:alertPower&&station?.data?.preRollActive===true,
    mchsPreRollRemainingMs:alertPower?station?.data?.preRollRemainingMs||0:0,
    mchsPowerEventId:alertPower?alert.eventId:null,
    reason:policy.emergencyOff?'Аварийное отключение':policy.mode==='MANUAL'?'Ручной режим':alertPower?
    'Основное оповещение МЧС':nextSlot?'Окно расписания (подготовка / эфир / задержка отключения)':autoDj.enabled?'Auto-DJ включён':'Нет активной трансляции',
    connection:connected?'ONLINE':'OFFLINE',agentMode:fresh?telemetry.agentMode:null,
    leaseValid:connected&&telemetry.leaseValid===true,physicalRelay:fresh?telemetry.amplifierPower||'UNKNOWN':'UNKNOWN',gpio:13,
    nextSlotStart:nextSlot?.startAt||null,hardwareReady:connected&&telemetry.relayOutputEnabled===true};
}
router.get('/agent/amplifier-intent',deviceAuth,safe(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const result=await ampDecision();
  const devices=await readEsp32Registry();
  // Agent must be expressly allowed to play; this endpoint does not issue
  // user-facing manual control tokens or expose any ESP32 pair secrets.
  const permit=!!req.radioDevice.playbackAllowed&&!!result.requested&&
    !result.policy.emergencyOff&&devices.length===1;
  res.json({permit,leaseMs:permit?8000:0,esp32Ip:devices.length===1?devices[0].ip:null,
    reason:result.reason,policyMode:result.mchsPowerEventId?'MCHS':result.policy.mode,
    mchsEventId:permit?result.mchsPowerEventId:null,
    mchsPreRollActive:permit&&result.mchsPreRollActive===true,
    mchsPreRollRemainingMs:permit?result.mchsPreRollRemainingMs:0,
    emergencyOff:result.policy.emergencyOff===true,hardwareExpected:'POWER_CONTROL_V1',
    evaluatedAt:new Date().toISOString()});
}));
router.get('/amplifier',...admin,safe(async(_req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.json(await ampDecision());
}));
router.post('/amplifier/policy',...admin,safe(async(req,res)=>{
  const {mode,manualOn,emergencyOff,preSeconds,postSeconds}=req.body||{};
  if(!['AUTO','MANUAL'].includes(mode)||typeof manualOn!=='boolean'||typeof emergencyOff!=='boolean'||
    !Number.isInteger(preSeconds)||preSeconds<0||preSeconds>600||
    !Number.isInteger(postSeconds)||postSeconds<0||postSeconds>600)
    return res.status(400).json({error:'Некорректные параметры усилителя'});
  const policy={mode,manualOn,emergencyOff,preSeconds,postSeconds,updatedAt:new Date().toISOString()};
  await prisma.setting.upsert({where:{key:AMP_KEY},create:{key:AMP_KEY,value:JSON.stringify(policy)},update:{value:JSON.stringify(policy)}});
  await prisma.adminAction.create({data:{adminId:req.user.id,action:'RADIO_AMPLIFIER_POLICY',payload:JSON.stringify(policy)}});
  res.json(await ampDecision());
}));
router.post('/esp32',...admin,safe(async(req,res)=>{
  const name=typeof req.body?.name==='string'?req.body.name.trim():'';
  const ip=typeof req.body?.ip==='string'?req.body.ip.trim():'';
  const gpio=req.body?.gpio;
  if(!name||name.length>80||!validLanIpv4(ip)||gpio!==13)
    return res.status(400).json({error:'Укажите имя, локальный IPv4 и GPIO 13'});
  const devices=await readEsp32Registry();
  if(devices.length>=50)return res.status(409).json({error:'Достигнут лимит устройств'});
  if(devices.some(d=>d.ip===ip))return res.status(409).json({error:'Этот IP уже зарегистрирован'});
  const device={id:randomBytes(12).toString('hex'),name,ip,gpio:13,
    firmware:'SAFE_PILOT',controlEnabled:false,createdAt:new Date().toISOString()};
  devices.push(device);
  await prisma.setting.upsert({where:{key:ESP32_REGISTRY_KEY},
    create:{key:ESP32_REGISTRY_KEY,value:JSON.stringify(devices)},
    update:{value:JSON.stringify(devices)}});
  res.status(201).json({device});
}));
router.delete('/esp32/:id',...admin,safe(async(req,res)=>{
  const devices=await readEsp32Registry();
  const updated=devices.filter(d=>d.id!==req.params.id);
  if(updated.length===devices.length)return res.status(404).json({error:'ESP32 не найден'});
  await prisma.setting.upsert({where:{key:ESP32_REGISTRY_KEY},
    create:{key:ESP32_REGISTRY_KEY,value:JSON.stringify(updated)},
    update:{value:JSON.stringify(updated)}});
  res.json({ok:true});
}));
router.post('/devices', ...admin, safe(async(req,res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length > 100) return res.status(400).json({ error:'Укажите название радиокомпьютера' });
  const token = 'rr_' + randomBytes(32).toString('hex');
  const device = await prisma.radioDevice.create({ data: { name, tokenHash: digest(token) } });
  res.status(201).json({ device: { id: device.id, name: device.name }, token });
}));
// Opt-in laboratory-only stream for ONE explicitly bound device. No station MP3 or ESP32.
// Passive integration probe for a running Windows Agent: NEVER switches audio.
router.get('/agent/mchs-integration-observe',deviceAuth,safe(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(process.env.MCHS_AGENT_LAB_STREAM_ENABLED!=='true'||
    !process.env.MCHS_AGENT_LAB_DEVICE_ID||
    req.radioDevice.id!==process.env.MCHS_AGENT_LAB_DEVICE_ID)
   return res.status(403).json({error:'INTEGRATION_OBSERVER_DISABLED'});
 try{
  const response=await workerMchsSessionRequest(null);
  const observed=response.data;
  if(!observed||!['IDLE','PROGRAM','ALERT'].includes(observed.phase)||
     !Number.isSafeInteger(observed.revision)||observed.revision<0)
    return res.status(503).json({error:'LAB_WORKER_INVALID_STATE',mode:'OBSERVE_ONLY'});
  res.json({mode:'OBSERVE_ONLY',stationPlaybackChanged:false,paOutputChanged:false,
   workerPhase:observed.phase,revision:observed.revision,
   pcmObservation:observed.pcmObservation||null,observedAt:new Date().toISOString()});
 }catch{
  res.status(503).json({error:'LAB_WORKER_UNAVAILABLE',mode:'OBSERVE_ONLY'});
 }
}));
// Authenticated observation of the newest real missile event. No playback commands.
router.get('/agent/mchs-event-observation',deviceAuth,safe(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!process.env.MCHS_AGENT_LAB_DEVICE_ID||req.radioDevice.id!==process.env.MCHS_AGENT_LAB_DEVICE_ID)
  return res.status(403).json({error:'DEVICE_NOT_BOUND'});
 const event=await prisma.safetyMchsEvent.findFirst({where:{source:'MCHS_ANDROID',verified:true},
  orderBy:{receivedAt:'desc'},select:{id:true,title:true,body:true,region:true,occurredAt:true}});
 const title=(event?.title||'').toLowerCase();
 const body=(event?.body||'').toLowerCase();
 const phrase=title+' '+body;
 const eventType=/(отбой|отмена).*(ракетн)/.test(phrase)?'MISSILE_ALL_CLEAR':
  /ракетн.*опасност/.test(phrase)?'MISSILE_DANGER':null;
 const age=Date.now()-new Date(event?.occurredAt).getTime();
 const allowed=!!event&&event.region?.trim().toLocaleLowerCase('ru-RU')==='тульская область'&&
  Number.isFinite(age)&&age>=0&&age<=120000&&!!eventType;
 res.json({eventId:allowed?event.id:null,eventType:allowed?eventType:null,
  observationOnly:true,automaticPlaybackEnabled:false,playbackCommand:null});
}));
router.post('/agent/mchs-event-observation-received',deviceAuth,safe(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!process.env.MCHS_AGENT_LAB_DEVICE_ID||req.radioDevice.id!==process.env.MCHS_AGENT_LAB_DEVICE_ID)
  return res.status(403).json({error:'DEVICE_NOT_BOUND'});
 const id=req.body?.eventId,type=req.body?.eventType;
 if(typeof id!=='string'||id.length>128||!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(type))
  return res.status(400).json({error:'INVALID_EVENT_RECEIPT'});
 const event=await prisma.safetyMchsEvent.findUnique({where:{id},
  select:{source:true,verified:true,occurredAt:true,region:true,title:true,body:true}});
 const age=Date.now()-new Date(event?.occurredAt).getTime();
 const phrase=((event?.title||'')+' '+(event?.body||'')).toLowerCase();
 const classified=/(отбой|отмена).*(ракетн)/.test(phrase)?'MISSILE_ALL_CLEAR':
  /ракетн.*опасност/.test(phrase)?'MISSILE_DANGER':null;
 if(!event||event.source!=='MCHS_ANDROID'||event.verified!==true||
    event.region?.trim().toLocaleLowerCase('ru-RU')!=='тульская область'||
    !Number.isFinite(age)||age<0||age>120000||classified!==type)
  return res.status(409).json({error:'EVENT_NOT_ELIGIBLE'});
 const key='mchs_agent_event_receipt_v1_'+req.radioDevice.id;
 const value=JSON.stringify({eventId:id,eventType:type,receiptOnly:true,status:'RECEIVED',
  observedAt:new Date().toISOString(),audioPlayed:false});
 await prisma.setting.upsert({where:{key},create:{key,value},update:{value}});
 res.json({accepted:true,receiptOnly:true,audioPlayed:false});
}));
// Authenticated, non-actuating HALT beacon. The Agent only confirms receipt.

// Production device-authenticated command transport. No automatic START is
// issued while the real-event authorization and audio binding are unverified.
// STOP is an actionable local trial cancellation, not a proof of PA silence.
// STOP-only device command polling; public START still requires production evidence.
// Explicit operator-approved rehearsal: does NOT manufacture an Android event.
// Its 2 synthetic WAV commands are delivered exclusively to the bound,
// already isolated Windows Agent, never to Worker, public MP3, or ESP32.
router.post('/mchs-agent-isolated-synthetic-cycle',...admin,safe(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(process.env.MCHS_ISOLATED_ANDROID_AUTO_TRIAL_ENABLED!=='true')
  return res.status(409).json({error:'ISOLATED_TRIAL_DISABLED'});
 if(req.body?.confirmation!=='HEADPHONES_ONLY_PA_DISCONNECTED')
  return res.status(400).json({error:'PHYSICAL_ISOLATION_CONFIRMATION_REQUIRED'});
 const deviceId=process.env.MCHS_AGENT_LAB_DEVICE_ID;
 if(!deviceId)return res.status(409).json({error:'DEVICE_NOT_BOUND'});
 const outcome=await prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581493)`;
  const cycleKey='mchs_agent_synthetic_cycle_v1_'+deviceId;
  const [cycleRow,readyRow,haltRow,deviceRow,autoRow]=await Promise.all([
   tx.setting.findUnique({where:{key:cycleKey}}),
   tx.setting.findUnique({where:{key:'mchs_agent_isolated_readiness_v1_'+deviceId}}),
   tx.setting.findUnique({where:{key:MCHS_DISPATCH_PROTOCOL_KEY}}),
   tx.setting.findUnique({where:{key:'mchs_agent_device_commands_v1_'+deviceId}}),
   tx.setting.findUnique({where:{key:'mchs_agent_isolated_android_auto_v1_'+deviceId}})
  ]);
  let cycle,halt,device,auto;
  try{cycle=JSON.parse(cycleRow?.value||'null');}catch{}
  try{halt=JSON.parse(haltRow?.value||'null');}catch{}
  try{device=JSON.parse(deviceRow?.value||'null');}catch{}
  try{auto=JSON.parse(autoRow?.value||'null');}catch{}
  if(normalizeMchsDispatchProtocol(halt).haltEpoch)
   return {ok:false,reason:'GLOBAL_HALT_ACTIVE'};
  if(device?.pending)return {ok:false,reason:'DEVICE_COMMAND_PENDING'};
  if(auto?.active)return {ok:false,reason:'ANDROID_EVENT_IN_PROGRESS'};
  const ready=readMchsAgentReadiness(readyRow?.value);
  const result=stageSyntheticHeadphonesCycle({
   state:cycle,readiness:ready,id:'synthetic_'+randomBytes(12).toString('hex')
  });
  if(!result.ok)return result;
  const value=JSON.stringify(result.state);
  await tx.setting.upsert({where:{key:cycleKey},
   create:{key:cycleKey,value},update:{value}});
  return {ok:true,cycleId:result.state.baseId,phase:result.state.phase};
 });
 if(!outcome.ok)return res.status(409).json({error:outcome.reason});
 res.status(202).json({...outcome,synthetic:true,headphonesOnly:true,
  publicPlaybackAuthorized:false,physicalPaOutputVerified:false});
}));

router.get('/agent/mchs-execution-command',deviceAuth,safe(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!process.env.MCHS_AGENT_LAB_DEVICE_ID||req.radioDevice.id!==process.env.MCHS_AGENT_LAB_DEVICE_ID)
  return res.status(403).json({error:'DEVICE_NOT_BOUND'});
 const key='mchs_agent_device_commands_v1_'+req.radioDevice.id;
 const [commandRow,haltRow]=await Promise.all([
  prisma.setting.findUnique({where:{key}}),
  prisma.setting.findUnique({where:{key:MCHS_DISPATCH_PROTOCOL_KEY}})
 ]);
 let ledger,raw;try{ledger=JSON.parse(commandRow?.value||'null');}catch{}
 try{raw=JSON.parse(haltRow?.value||'null');}catch{}
 const state=normalizeMchsDispatchProtocol(raw);
 const delivered=advanceMchsDeviceCommand(ledger||{}, {type:'DELIVER'});
 const selected=selectMchsAgentCommand({
  delivered,ledger,dispatch:state,
  isolatedTrialEnabled:process.env.MCHS_ISOLATED_AGENT_TRIAL_START_ENABLED==='true',
  deviceTrialBound:req.radioDevice.id===process.env.MCHS_AGENT_LAB_DEVICE_ID
 });
 // Operator-staged SYNTHETIC rehearsal is separate from Android records.
 // Real STOP and dispatch HALT always win. One locked cycle per device.
 if(process.env.MCHS_ISOLATED_ANDROID_AUTO_TRIAL_ENABLED==='true'&&
    selected.reason==='NO_START_QUEUED'&&!state.haltEpoch){
  const rehearsal=await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581493)`;
   const syntheticKey='mchs_agent_synthetic_cycle_v1_'+req.radioDevice.id;
   const [row,readyRow,historyRow]=await Promise.all([
    tx.setting.findUnique({where:{key:syntheticKey}}),
    tx.setting.findUnique({where:{key:'mchs_agent_isolated_readiness_v1_'+req.radioDevice.id}}),
    tx.setting.findUnique({where:{key:'mchs_agent_event_execution_history_v1_'+req.radioDevice.id}})
   ]);
   let prior;try{prior=JSON.parse(row?.value||'null');}catch{}
   if(!prior||!['DANGER_PENDING','DANGER_WAIT','CLEAR_PENDING','CLEAR_WAIT'].includes(prior.phase))
    return null;
   const result=advanceSyntheticHeadphonesCycle(prior,{
    readiness:readMchsAgentReadiness(readyRow?.value),
    observations:readMchsExecutionObservationHistory(historyRow?.value)
   });
   const value=JSON.stringify(result.state);
   await tx.setting.upsert({where:{key:syntheticKey},
    create:{key:syntheticKey,value},update:{value}});
   return result;
  });
  if(rehearsal){
   return res.json({version:1,command:rehearsal.command,
    halted:false,executionEnabled:!!rehearsal.command,
    automaticPlaybackEnabled:false,reason:rehearsal.reason,
    syntheticTraining:true,isolatedHeadphonesOnly:true,
    haltEpoch:state.haltEpoch});
  }
 }
 // Separate, explicitly opted-in headphone test. Never replaces STOP/HALT,
 // grants public playback, or upgrades Android bridge auth to official provenance.
 if(process.env.MCHS_ISOLATED_ANDROID_AUTO_TRIAL_ENABLED==='true'&&
    selected.reason==='NO_START_QUEUED'&&!state.haltEpoch){
  const channels=(process.env.MCHS_MISSILE_TRUSTED_CHANNEL_IDS||'').split(',')
   .map(x=>x.trim()).filter(Boolean);
  const auto=await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581493)`;
   const autoKey='mchs_agent_isolated_android_auto_v1_'+req.radioDevice.id;
   const [autoRow,readyRow,historyRow,events]=await Promise.all([
    tx.setting.findUnique({where:{key:autoKey}}),
    tx.setting.findUnique({where:{key:'mchs_agent_isolated_readiness_v1_'+req.radioDevice.id}}),
    tx.setting.findUnique({where:{key:'mchs_agent_event_execution_history_v1_'+req.radioDevice.id}}),
    tx.safetyMchsEvent.findMany({where:{source:'MCHS_ANDROID'},
     orderBy:{receivedAt:'desc'},take:40,
     select:{id:true,source:true,sourceEventId:true,channelId:true,
      title:true,body:true,occurredAt:true,region:true}})
   ]);
   let prior;try{prior=JSON.parse(autoRow?.value||'null');}catch{prior=null;}
   const ready=readMchsAgentReadiness(readyRow?.value);
   const observations=readMchsExecutionObservationHistory(historyRow?.value);
   const result=advanceIsolatedAndroidAutoFeed(prior,{
    events,observations,readiness:ready,allowedChannels:channels,
    dangerRepeats:Number(process.env.MCHS_ISOLATED_DANGER_REPEATS||1)
   });
   // Persist replay state transactionally, never requeue a delivered event.
   const value=JSON.stringify(result.state);
   await tx.setting.upsert({where:{key:autoKey},
    create:{key:autoKey,value},update:{value}});
   return result;
  });
  if(auto.command)return res.json({version:1,command:auto.command,
   halted:false,executionEnabled:true,automaticPlaybackEnabled:false,
   reason:auto.reason,isolatedHeadphonesOnly:true,haltEpoch:state.haltEpoch});
  if(['ALREADY_QUEUED','AWAITING_LOCAL_COMPLETION','NO_NEW_ANDROID_EVENT'].includes(auto.reason))
   return res.json({version:1,command:null,halted:false,
    executionEnabled:false,automaticPlaybackEnabled:false,
    reason:auto.reason,isolatedHeadphonesOnly:true,haltEpoch:state.haltEpoch});
 }
 res.json({version:1,...selected,haltEpoch:state.haltEpoch});
}));
router.post('/agent/mchs-execution-command-receipt',deviceAuth,safe(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!process.env.MCHS_AGENT_LAB_DEVICE_ID||req.radioDevice.id!==process.env.MCHS_AGENT_LAB_DEVICE_ID)
  return res.status(403).json({error:'DEVICE_NOT_BOUND'});
 const body=req.body||{};
 if(body.version!==1||body.action!=='STOP'||body.commandId!=='HALT'||
   typeof body.haltEpoch!=='string'||body.haltEpoch.length>40||
   body.confirmed!==true||body.playbackState!=='STOPPED')
  return res.status(400).json({error:'INVALID_COMMAND_RECEIPT'});
 const row=await prisma.setting.findUnique({where:{key:MCHS_DISPATCH_PROTOCOL_KEY}});
 let raw;try{raw=JSON.parse(row?.value||'null');}catch{}
 const state=normalizeMchsDispatchProtocol(raw);
 if(!state.haltEpoch||state.haltEpoch!==body.haltEpoch)
  return res.status(409).json({error:'HALT_EPOCH_MISMATCH'});
 const key='mchs_agent_execution_stop_receipt_v1_'+req.radioDevice.id;
 const value=JSON.stringify({commandId:'HALT',haltEpoch:body.haltEpoch,
  localTrialStoppedConfirmed:true,realEventPlaybackConfirmed:false,
  physicalPaStoppedVerified:false,receivedAt:new Date().toISOString()});
 await prisma.setting.upsert({where:{key},create:{key,value},update:{value}});
 res.json({accepted:true,localTrialStoppedConfirmed:true,
  realEventPlaybackConfirmed:false,physicalPaStoppedVerified:false});
}));


// Admin emergency STOP queues a device-bound, expiring STOP regardless of
// START readiness. It does not assert physical PA output has been silenced.
router.post('/mchs-agent-queue-stop',...admin,safe(async(req,res)=>{
 const {eventId,eventType}=req.body||{};
 const deviceId=process.env.MCHS_AGENT_LAB_DEVICE_ID;
 if(!deviceId)return res.status(503).json({error:'DEVICE_NOT_BOUND'});
 const key='mchs_agent_device_commands_v1_'+deviceId;
 const result=await prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581457)`;
  const row=await tx.setting.findUnique({where:{key}});
  let current;try{current=JSON.parse(row?.value||'null');}catch{}
  const updated=advanceMchsDeviceCommand(current||{}, {type:'QUEUE_STOP',eventId,eventType});
  if(!updated.ok)return updated;
  const value=JSON.stringify(updated.state);
  await tx.setting.upsert({where:{key},create:{key,value},update:{value}});
  return updated;
 });
 if(!result.ok)return res.status(400).json({error:result.reason});
 res.json({queued:true,sequence:result.state.sequence,physicalStopVerified:false});
}));

// Event-scoped STOP receipt: only confirms that the Agent's isolated VLC
// is gone. It must never be interpreted as physical PA verification.
router.post('/agent/mchs-device-stop-received',deviceAuth,safe(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!process.env.MCHS_AGENT_LAB_DEVICE_ID||req.radioDevice.id!==process.env.MCHS_AGENT_LAB_DEVICE_ID)
  return res.status(403).json({error:'DEVICE_NOT_BOUND'});
 const receipt=req.body||{};
 if(receipt.action!=='STOP'||receipt.confirmed!==true||
    receipt.playbackState!=='STOPPED'||!Number.isSafeInteger(receipt.sequence)||
    receipt.localTrialStoppedConfirmed!==true)
  return res.status(400).json({error:'INVALID_STOP_RECEIPT'});
 const key='mchs_agent_device_commands_v1_'+req.radioDevice.id;
 const result=await prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581457)`;
  const row=await tx.setting.findUnique({where:{key}});
  let state;try{state=JSON.parse(row?.value||'null');}catch{}
  const next=advanceMchsDeviceCommand(state||{},{type:'RECEIPT',receipt});
  if(!next.ok)return next;
  const value=JSON.stringify(next.state);
  await tx.setting.upsert({where:{key},create:{key,value},update:{value}});
  return next;
 });
 if(!result.ok)return res.status(409).json({error:result.reason});
 res.json({accepted:true,localTrialStoppedConfirmed:true,
   realEventPlaybackConfirmed:false,physicalPaStoppedVerified:false});
}));

router.get('/agent/mchs-dispatch-halt',deviceAuth,safe(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!process.env.MCHS_AGENT_LAB_DEVICE_ID||req.radioDevice.id!==process.env.MCHS_AGENT_LAB_DEVICE_ID)
  return res.status(403).json({error:'DEVICE_NOT_BOUND'});
 const row=await prisma.setting.findUnique({where:{key:MCHS_DISPATCH_PROTOCOL_KEY}});
 let raw;try{raw=JSON.parse(row?.value||'null');}catch{}
 const state=normalizeMchsDispatchProtocol(raw);
 res.json({halted:true,haltEpoch:state.haltEpoch,executionEnabled:false,automaticPlaybackEnabled:false});
}));
router.post('/agent/mchs-dispatch-halt-received',deviceAuth,safe(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!process.env.MCHS_AGENT_LAB_DEVICE_ID||req.radioDevice.id!==process.env.MCHS_AGENT_LAB_DEVICE_ID)
  return res.status(403).json({error:'DEVICE_NOT_BOUND'});
 const epoch=req.body?.haltEpoch;
 if(typeof epoch!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(epoch))
  return res.status(400).json({error:'INVALID_HALT_EPOCH'});
 const result=await prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581452)`;
  const row=await tx.setting.findUnique({where:{key:MCHS_DISPATCH_PROTOCOL_KEY}});
  let raw;try{raw=JSON.parse(row?.value||'null');}catch{}
  const state=normalizeMchsDispatchProtocol(raw);
  if(!state.haltEpoch||state.haltEpoch!==epoch)return {accepted:false};
  const key='mchs_agent_halt_seen_v1_'+req.radioDevice.id;
  const value=JSON.stringify({haltEpoch:epoch,receivedAt:new Date().toISOString(),receiptOnly:true,
   playbackStoppedVerified:false,paStoppedVerified:false});
  await tx.setting.upsert({where:{key},create:{key,value},update:{value}});
  return {accepted:true};
 });
 if(!result.accepted)return res.status(409).json({error:'STALE_HALT_EPOCH'});
 res.json({accepted:true,receiptOnly:true,playbackStoppedVerified:false,paStoppedVerified:false});
}));
// Evidence of termination of the *isolated* lab VLC process only.
// Real local VLC state telemetry. This is NOT an event-scoped ALARM playback ACK.
router.post('/agent/mchs-trial-vlc-state',deviceAuth,safe(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!process.env.MCHS_AGENT_LAB_DEVICE_ID||req.radioDevice.id!==process.env.MCHS_AGENT_LAB_DEVICE_ID)
  return res.status(403).json({error:'DEVICE_NOT_BOUND'});
 const {state,processRunning}=req.body||{};
 if(!['STARTED','STOPPED'].includes(state)||typeof processRunning!=='boolean'||
    (state==='STARTED'&&!processRunning)||(state==='STOPPED'&&processRunning))
  return res.status(400).json({error:'INVALID_VLC_STATE'});
 const value=JSON.stringify({state,processRunning,mode:'LAB_PROCESS_ONLY',
  receivedAt:new Date().toISOString(),eventPlaybackConfirmed:false,
  publicAudioVerified:false});
 const key='mchs_agent_trial_vlc_state_v1_'+req.radioDevice.id;
 await prisma.setting.upsert({where:{key},create:{key,value},update:{value}});
 res.json({accepted:true,mode:'LAB_PROCESS_ONLY',eventPlaybackConfirmed:false});
}));
router.post('/agent/mchs-trial-process-stop',deviceAuth,safe(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!process.env.MCHS_AGENT_LAB_DEVICE_ID||req.radioDevice.id!==process.env.MCHS_AGENT_LAB_DEVICE_ID)
  return res.status(403).json({error:'DEVICE_NOT_BOUND'});
 const evidence=validateMchsTrialStopEvidence(req.body);
 if(!evidence)return res.status(400).json({error:'INVALID_TRIAL_STOP_EVIDENCE'});
 const key='mchs_trial_process_stop_v1_'+req.radioDevice.id;
 const value=JSON.stringify({...evidence,receivedAt:new Date().toISOString()});
 await prisma.setting.upsert({where:{key},create:{key,value},update:{value}});
 res.json({accepted:true,labProcessStopConfirmed:evidence.confirmed,
  stationPlaybackStoppedVerified:false,paOutputVerified:false,dispatchAuthorized:false});
}));
router.get('/mchs-trial-process-stop',...admin,safe(async(_req,res)=>{
 res.setHeader('Cache-Control','no-store');
 const id=process.env.MCHS_AGENT_LAB_DEVICE_ID||'';
 if(!id)return res.json({evidence:null,confirmed:false});
 const row=await prisma.setting.findUnique({where:{key:'mchs_trial_process_stop_v1_'+id}});
 let evidence;try{evidence=JSON.parse(row?.value||'null');}catch{}
 res.json({evidence:evidence||null,stationPlaybackStoppedVerified:false,
  paOutputVerified:false,dispatchAuthorized:false});
}));
// Read-only integration telemetry: no MCHS command or station output changes.
router.post('/agent/mchs-observer-report',deviceAuth,safe(async(req,res)=>{
 if(process.env.MCHS_AGENT_LAB_STREAM_ENABLED!=='true'||
    !process.env.MCHS_AGENT_LAB_DEVICE_ID||
    req.radioDevice.id!==process.env.MCHS_AGENT_LAB_DEVICE_ID)
   return res.status(403).json({error:'INTEGRATION_OBSERVER_DISABLED'});
 const d=req.body||{},p=d.preflight||{};
 if(d.mode!=='OBSERVE_ONLY'||!['IDLE','PROGRAM','ALERT','UNKNOWN'].includes(d.workerPhase)||
    !Number.isSafeInteger(d.revision)||d.revision<0||
    !['OBSERVABLE_ONLY','AUTHORIZATION_STALE','NO_LOCAL_PLAYBACK','PRIMARY_AUDIO_STALE','OUTPUT_UNVERIFIED'].includes(d.code)||
    typeof d.primaryAlive!=='boolean'||typeof d.reserveAlive!=='boolean'||
    p.mode!=='PREFLIGHT_ONLY'||typeof p.readyForControlledAudioTrial!=='boolean'||
    p.hardwareSwitchAuthorized!==false||p.physicalIsolationVerifiedBySoftware!==false||
    d.audioInterruptionVerified!==false||d.paOutputVerified!==false)
   return res.status(400).json({error:'INVALID_OBSERVER_REPORT'});
 const t=d.transition;
 if(t!==null&&t!==undefined&&
    (t.mode!=='OBSERVE_ONLY'||!['BASELINE','EXPECTED','MISSED_REVISIONS','UNEXPECTED'].includes(t.transitionState)||
     !Number.isSafeInteger(t.observedRevision)||t.observedRevision!==d.revision||
     !Number.isSafeInteger(t.missedRevisions)||t.missedRevisions<0||
     !['IDLE','PROGRAM','ALERT'].includes(t.currentPhase)||t.currentPhase!==d.workerPhase||
     (t.previousPhase!==null&&!['IDLE','PROGRAM','ALERT'].includes(t.previousPhase))))
   return res.status(400).json({error:'INVALID_OBSERVER_TRANSITION'});
 const report={mode:'OBSERVE_ONLY',workerPhase:d.workerPhase,revision:d.revision,code:d.code,
   primaryAlive:d.primaryAlive,reserveAlive:d.reserveAlive,
   transition:t?{transitionState:t.transitionState,previousPhase:t.previousPhase,
     currentPhase:t.currentPhase,missedRevisions:t.missedRevisions,observedRevision:t.observedRevision}:null,
   readyForControlledAudioTrial:false,audioInterruptionVerified:false,paOutputVerified:false,
   receivedAt:new Date().toISOString()};
 const key='mchs_agent_observer_v1_'+req.radioDevice.id;
 await prisma.setting.upsert({where:{key},create:{key,value:JSON.stringify(report)},update:{value:JSON.stringify(report)}});
 res.json({accepted:true});
}));
router.get('/mchs-observer-status',...admin,safe(async(_req,res)=>{
 res.setHeader('Cache-Control','no-store');
 const id=process.env.MCHS_AGENT_LAB_DEVICE_ID||'';
 if(!id||process.env.MCHS_AGENT_LAB_STREAM_ENABLED!=='true')
   return res.json({enabled:false,status:'DISABLED',report:null});
 const row=await prisma.setting.findUnique({where:{key:'mchs_agent_observer_v1_'+id}});
 let report=null;try{report=JSON.parse(row?.value||'null');}catch{}
 const age=report?.receivedAt?Date.now()-Date.parse(report.receivedAt):Infinity;
 res.json({enabled:true,status:Number.isFinite(age)&&age>=0&&age<20000?'FRESH':'STALE',
   report:Number.isFinite(age)&&age>=0&&age<20000?report:null});
}));
router.get('/agent/mchs-lab-pcm',deviceAuth,(req,res)=>{
 const enabled=process.env.MCHS_AGENT_LAB_STREAM_ENABLED==='true';
 const bound=String(process.env.MCHS_AGENT_LAB_DEVICE_ID||'');
 if(!enabled||!bound||req.radioDevice.id!==bound||!req.radioDevice.playbackAllowed)
   return res.status(403).json({error:'Лабораторный выход не разрешён для этого устройства'});
 const port=Number(process.env.RADIO_PLAYOUT_PORT||4105),secret=process.env.RADIO_PLAYOUT_SECRET||'';
 if(!Number.isInteger(port)||port<1||port>65535||secret.length<32)
   return res.status(503).json({error:'Worker не настроен'});
 let disconnected=false;
 const upstream=http.get({hostname:'127.0.0.1',port,path:'/mchs-lab/session/stream.pcm',
  headers:{'x-radio-worker-secret':secret},timeout:4000},source=>{
   if(source.statusCode!==200){source.resume();return res.status(503).end();}
   upstream.setTimeout(0);
   res.set({'Content-Type':'application/octet-stream','Cache-Control':'no-store, no-transform',
    'X-Content-Type-Options':'nosniff','X-Accel-Buffering':'no',
    'X-Lab-Format':'s16le;rate=24000;channels=1'});
   source.pipe(res);
   source.on('error',()=>res.destroy());
 });
 upstream.on('timeout',()=>upstream.destroy(new Error('WORKER_TIMEOUT')));
 upstream.on('error',()=>{if(!disconnected){if(!res.headersSent)res.status(503).end();else res.destroy();}});
 res.on('close',()=>{disconnected=true;upstream.destroy();});
});
router.post('/agent/audio-telemetry',deviceAuth,safe(async(req,res)=>{
 const report=validateAudioReport(req.body);
 if(!report)return res.status(400).json({error:'Некорректное состояние аудиоустройства'});
 const key='radio_agent_audio_v1_'+req.radioDevice.id;
 const value=JSON.stringify({...report,receivedAt:new Date().toISOString()});
 await prisma.setting.upsert({where:{key},create:{key,value},update:{value}});
 await prisma.radioDevice.update({where:{id:req.radioDevice.id},data:{lastSeenAt:new Date()}});
 res.setHeader('Cache-Control','no-store');
 res.json({accepted:true});
}));
router.get('/dashboard/devices-health',...admin,safe(async(_req,res)=>{
 const devices=await prisma.radioDevice.findMany({
  select:{id:true,name:true,lastSeenAt:true,revokedAt:true,playbackAllowed:true},
  orderBy:{createdAt:'desc'},take:100});
 const amplifier=await ampDecision();
 const active=devices.filter(d=>!d.revokedAt);
 const telemetry=await prisma.setting.findMany({where:{key:{in:active.map(d=>'radio_agent_audio_v1_'+d.id)}},select:{key:true,value:true}});
 const lookup=new Map(telemetry.map(row=>{try{return[row.key,JSON.parse(row.value)];}catch{return[row.key,null];}}));
 const agents=summarizeRadioAgents(devices);
 agents.agents=agents.agents.map(agent=>({...agent,audio:audioHealth(lookup.get('radio_agent_audio_v1_'+agent.id))}));

 res.setHeader('Cache-Control','no-store');
 res.json({generatedAt:new Date().toISOString(),agents,
  amplifier:{connection:amplifier.connection,physicalRelay:amplifier.physicalRelay,
   hardwareReady:amplifier.hardwareReady,leaseValid:amplifier.leaseValid,
   emergencyOff:!!amplifier.policy?.emergencyOff,mode:amplifier.policy?.mode,
   requested:amplifier.requested,reason:amplifier.reason}});
}));
router.get('/devices', ...admin, safe(async(_req,res) => {
  const devices = await prisma.radioDevice.findMany({ orderBy: { createdAt:'desc' }, select: {
    id:true, name:true, createdAt:true, lastSeenAt:true, revokedAt:true, playbackAllowed:true,
  } });
  res.json({ devices });
}));
router.post('/devices/:id/revoke', ...admin, safe(async(req,res) => {
  const changed = await prisma.radioDevice.updateMany({ where: { id: req.params.id, revokedAt:null },
    data:{ revokedAt:new Date() } });
  if (!changed.count) return res.status(404).json({error:'Устройство не найдено или уже отключено'});
  res.json({ok:true});
}));
router.post('/devices/:id/playback', ...admin, safe(async(req,res) => {
  if (typeof req.body?.enabled !== 'boolean') return res.status(400).json({error:'Передайте enabled: true или false'});
  const changed=await prisma.radioDevice.updateMany({where:{id:req.params.id,revokedAt:null},
    data:{playbackAllowed:req.body.enabled}});
  if(!changed.count) return res.status(404).json({error:'Устройство не найдено или отключено'});
  res.json({ok:true,playbackAllowed:req.body.enabled});
}));
router.get('/agent/status', deviceAuth, safe(async(req,res) => {
  await prisma.radioDevice.update({ where: { id:req.radioDevice.id }, data:{lastSeenAt:new Date()} });
  res.json({ deviceId:req.radioDevice.id, mode:req.radioDevice.playbackAllowed ? 'PILOT' : 'SYNC_ONLY', timezone:'Europe/Moscow', serverTime:new Date().toISOString(),
    playbackEnabled:!!req.radioDevice.playbackAllowed, amplifierControlEnabled:false });
}));
// Single station-wide playback position for future server stream and local failover.
router.get('/agent/stream', deviceAuth, (req,res) => {
  if(!req.radioDevice.playbackAllowed) return res.status(403).json({error:'Воспроизведение запрещено'});
  return streamWorker(req,res);
});
// Limited public metadata; never expose device tokens, Worker diagnostics or private files.
// A single station-wide metadata latency setting, administered in the control room.
const RADIO_METADATA_SYNC_KEY='radio_metadata_sync_v1';
const defaultMetadataSync={mode:'auto',manualDelay:8};
async function readMetadataSync(){
  const row=await prisma.setting.findUnique({where:{key:RADIO_METADATA_SYNC_KEY}});
  try {
    const parsed=JSON.parse(row?.value||'null');
    if(parsed && ['auto','manual','off'].includes(parsed.mode) &&
       Number.isFinite(parsed.manualDelay) && parsed.manualDelay>=0 && parsed.manualDelay<=30)
      return {mode:parsed.mode,manualDelay:parsed.manualDelay};
  }catch {/* invalid legacy setting */}
  return defaultMetadataSync;
}
router.get('/listen/metadata-sync',safe(async(_req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.json(await readMetadataSync());
}));
router.put('/dashboard/metadata-sync',...admin,safe(async(req,res)=>{
  const {mode,manualDelay}=req.body||{};
  if(!['auto','manual','off'].includes(mode) ||
     typeof manualDelay!=='number' || !Number.isFinite(manualDelay) ||
     manualDelay<0 || manualDelay>30)
    return res.status(400).json({error:'Некорректная настройка синхронизации'});
  const value={mode,manualDelay};
  await prisma.setting.upsert({where:{key:RADIO_METADATA_SYNC_KEY},
    create:{key:RADIO_METADATA_SYNC_KEY,value:JSON.stringify(value)},
    update:{value:JSON.stringify(value)}});
  res.json(value);
}));
const RADIO_LIVE_DESIGN_KEY='radio_live_design_v1';
const RADIO_LIVE_TEXT_LIMITS={
 headerSubtitle:80,eyebrow:80,stationTagline:80,
 heroLine1:100,heroLine2:100,heroLine3:100,description:500,
 inviteEyebrow:100,inviteTitle:120,inviteDescription:500,
 inviteButton:80,sideFooter:180,footerText:250
};
const RADIO_LIVE_BOOLEAN_KEYS=['showInvite','showWaves','showSideFooter','showStationClock'];
const RADIO_LIVE_COLOR_KEYS=['accent','background'];
async function readRadioLiveDesign(){
 const row=await prisma.setting.findUnique({where:{key:RADIO_LIVE_DESIGN_KEY}});
 try {const value=JSON.parse(row?.value||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
 catch{return {};}
}
router.get('/listen/design',safe(async(_req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.json(await readRadioLiveDesign());
}));
router.get('/dashboard/live-design',...admin,safe(async(_req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.json(await readRadioLiveDesign());
}));
router.put('/dashboard/live-design',...admin,safe(async(req,res)=>{
 const body=req.body;
 if(!body||typeof body!=='object'||Array.isArray(body))
  return res.status(400).json({error:'Некорректный формат настроек'});
 const value={};
 for(const [key,max] of Object.entries(RADIO_LIVE_TEXT_LIMITS)){
  if(typeof body[key]!=='string'||body[key].length>max)
   return res.status(400).json({error:'Некорректное поле '+key});
  value[key]=body[key];
 }
 for(const key of RADIO_LIVE_BOOLEAN_KEYS){
  if(typeof body[key]!=='boolean')return res.status(400).json({error:'Некорректное поле '+key});
  value[key]=body[key];
 }
 for(const key of RADIO_LIVE_COLOR_KEYS){
  if(typeof body[key]!=='string'||!/^#[0-9a-fA-F]{6}$/.test(body[key]))
   return res.status(400).json({error:'Некорректный цвет '+key});
  value[key]=body[key];
 }
 await prisma.setting.upsert({where:{key:RADIO_LIVE_DESIGN_KEY},
  create:{key:RADIO_LIVE_DESIGN_KEY,value:JSON.stringify(value)},
  update:{value:JSON.stringify(value)}});
 await prisma.adminAction.create({data:{adminId:req.user.id,action:'RADIO_LIVE_DESIGN_UPDATE',payload:JSON.stringify({fields:Object.keys(value)})}});
 res.json(value);
}));
router.get('/listen/now-playing',safe(async(_req,res)=>{
  res.setHeader('Cache-Control','no-store');
  let worker;
  try{worker=await workerRequest('GET','/health');}
  catch{return res.status(503).json({available:false});}
  const trackId=typeof worker.trackId==='string'?worker.trackId:null;
  const asset=trackId?await prisma.radioAsset.findUnique({where:{id:trackId},select:{name:true,tags:true,durationMs:true}}):null;
  const nextSlot=worker.mode==='SILENCE'?await prisma.radioScheduleSlot.findFirst({
    where:{startAt:{gt:new Date()},playlist:{status:'APPROVED'}},
    orderBy:{startAt:'asc'},select:{startAt:true,playlist:{select:{name:true}}}
  }):null;
  const now=new Date();
  // Resolve by the actual Worker authority, not by the first matching schedule interval.
  // During AutoDJ handoff or an overlapping schedule, clock-only lookup can label
  // the wrong show (or hide the correct presenters entirely).
  const activeSlotId=typeof worker.slotId==='string'&&worker.slotId?worker.slotId:null;
  const show=activeSlotId&&worker.mode!=='AUTO_DJ'&&worker.mode!=='SILENCE'
    ?await prisma.radioScheduleSlot.findFirst({
      where:{id:activeSlotId,startAt:{lte:now},endAt:{gt:now},playlist:{status:'APPROVED'}},
      select:{id:true,title:true,startAt:true,endAt:true,hostIds:true,playlist:{select:{name:true}}}
    }):null;
  const hostIds=show?.hostIds||[];
  const members=hostIds.length?await prisma.editorialTeamMember.findMany({
    where:{userId:{in:hostIds},position:'RADIO_HOST'},
    include:{user:{select:{id:true,username:true,fullName:true,firstName:true,lastName:true,avatar:true}}}
  }):[];
  const hostMap=new Map(members.filter(m=>m.user).map(m=>[m.userId,m.user]));
  const currentShow=show?{id:show.id,name:show.title||show.playlist?.name||'Передача',startAt:show.startAt,endAt:show.endAt,
    hosts:hostIds.map(id=>hostMap.get(id)).filter(Boolean)}:null;
  res.json({available:true,mode:worker.mode,currentShow,
    nextShow:worker.mode==='SILENCE'&&nextSlot?{name:nextSlot.playlist.name,startAt:nextSlot.startAt.toISOString()}:null,
    track:asset?{name:asset.name,title:asset.tags?.title||null,artist:asset.tags?.artist||null,durationMs:asset.durationMs}:null,
    playout:worker.playout?.trackId===trackId?{startedAt:worker.playout.startedAt,
      emittedMs:worker.playout.emittedMs,seekMs:worker.playout.seekMs,durationMs:worker.playout.durationMs}:null,
    observedAt:Date.now()});
}));
// Browser <audio> does not send bearer headers; public station output is intentionally listen-only.
router.get('/listen', (req,res)=>streamWorker(req,res));
router.get('/dashboard/worker', ...admin, workerHealth);
router.get('/dashboard/now-playing',...admin,safe(async(_req,res)=>{
  res.setHeader('Cache-Control','no-store');
  let status;
  try{status=await workerRequest('GET','/health');}
  catch{return res.status(503).json({available:false,reason:'WORKER_UNAVAILABLE'});}
  const mode=typeof status?.mode==='string'?status.mode:'UNKNOWN';
  const trackId=typeof status?.trackId==='string'?status.trackId:null;
  const slotId=typeof status?.slotId==='string'?status.slotId:null;
  const nextTrackId=typeof status?.nextTrackId==='string'?status.nextTrackId:null;
  const [asset,slot,nextAsset,nextSlot]=await Promise.all([
    trackId?prisma.radioAsset.findUnique({where:{id:trackId},select:{id:true,name:true,durationMs:true,tags:true}}):null,
    slotId?prisma.radioScheduleSlot.findUnique({where:{id:slotId},select:{id:true,endAt:true,playlist:{select:{name:true,items:{orderBy:{position:'asc'},include:{asset:{select:{id:true,name:true,tags:true}}}}}}}}):null,
    nextTrackId?prisma.radioAsset.findUnique({where:{id:nextTrackId},select:{id:true,name:true,tags:true}}):null,
    prisma.radioScheduleSlot.findFirst({where:{startAt:{gt:new Date()},playlist:{status:'APPROVED'}},orderBy:{startAt:'asc'},select:{id:true,startAt:true,playlist:{select:{name:true,items:{orderBy:{position:'asc'},take:1,include:{asset:{select:{id:true,name:true,tags:true}}}}}}}}),
  ]);
  // Scheduled playlists advance by their saved order. They override Auto-DJ projections.
  let scheduledNext=null;
  if(mode==='SCHEDULED'&&slot?.playlist?.items?.length){
    const items=slot.playlist.items;
    const index=items.findIndex(i=>i.asset.id===trackId);
    const following=index>=0?items[index+1]?.asset:null;
    if(following)scheduledNext={id:following.id,name:following.name,
      title:following.tags?.title||null,artist:following.tags?.artist||null,estimated:true};
  }
  res.json({available:true,source:'PUBLIC_MP3_WORKER',mode,
    track:asset?{id:asset.id,name:asset.name,durationMs:asset.durationMs,
      title:asset.tags?.title||null,artist:asset.tags?.artist||null}:null,
    slot:slot?{id:slot.id,name:slot.playlist?.name||'Передача'}:null,
    trackId,slotId,trackResolved:!trackId||Boolean(asset),observedAt:new Date().toISOString(),
    playout:status.playout?.trackId===trackId?status.playout:null,
    nextTrack:scheduledNext||(mode==='AUTO_DJ'&&nextAsset?{id:nextAsset.id,name:nextAsset.name,title:nextAsset.tags?.title||null,artist:nextAsset.tags?.artist||null,estimated:true}:null),
    upcomingSlot:nextSlot?{id:nextSlot.id,name:nextSlot.playlist.name,startAt:nextSlot.startAt,
      firstTrack:nextSlot.playlist.items[0]?.asset?.name||null}:null,
    listenerCount:Number.isFinite(status?.connected)?status.connected:null,
    lastError:typeof status?.lastError==='string'?status.lastError:null});
}));

router.get('/agent/stream-pilot', deviceAuth, safe(async (req,res) => {
  if (!req.radioDevice.playbackAllowed) return res.status(403).json({error:'Тестовое воспроизведение запрещено'});
  await servePilotStream(req,res);
}));
router.get('/dashboard', ...admin, safe(async (_req,res) => {
  const {cursor}=await stationSnapshot();
  const devices=await prisma.radioDevice.findMany({
    where:{revokedAt:null}, select:{id:true,name:true,lastSeenAt:true,playbackAllowed:true},
    orderBy:{createdAt:'desc'},take:40,
  });
  const upcoming=await prisma.radioScheduleSlot.findMany({
    where:{startAt:{gt:new Date()},playlist:{status:'APPROVED'}},
    orderBy:{startAt:'asc'},take:6,include:{playlist:{select:{name:true}}},
  });
  res.setHeader('Cache-Control','no-store');
  const autoDj=await getAutoDj();
  const autoDjConfigured=await readAutoDjSettings();
  res.json({autoDj:{configured:autoDjConfigured.enabled,ready:autoDj.enabled,
    playlistId:autoDjConfigured.playlistId,trackCount:autoDj.tracks.length,
    reason:!autoDjConfigured.enabled?'DISABLED':autoDj.enabled?'READY':'PLAYLIST_UNAVAILABLE'},
    serverTime:new Date().toISOString(),timezone:'Europe/Moscow',
    stream:stationStreamHealth(),cursor,devices,
    upcoming:upcoming.map(s=>({id:s.id,startAt:s.startAt,endAt:s.endAt,name:s.playlist.name})),
    amplifier:{connected:false},liveStudio:{integration:'SEPARATE_WEBRTC_PILOT'}});
}));
async function getAutoDj() {
  const config=await readAutoDjSettings();
  if(!config.enabled||!config.playlistId)return {enabled:false,playlistId:null,tracks:[]};
  const playlist=await prisma.radioPlaylist.findUnique({where:{id:config.playlistId},include:{items:{orderBy:{position:'asc'},include:{asset:true}}}});
  const tracks=selectAutoDjAssets(playlist);
  return {enabled:tracks.length>0,playlistId:config.playlistId,tracks};
}
const autoDjTrack = asset => ({id:asset.id,name:asset.name,sha256:asset.sha256,
  byteSize:asset.byteSize,durationMs:asset.durationMs,url:'/api/radio-agent/agent/assets/'+asset.id});
router.get('/agent/now-playing', deviceAuth, safe(async(req,res) => {
  const now = new Date();
  const slots = await prisma.radioScheduleSlot.findMany({
    where: { startAt: { lte: now }, endAt: { gt: now }, playlist: { status: 'APPROVED' } },
    include: { playlist: { include: { items: {
      orderBy: { position: 'asc' }, include: { asset: {
        select: { id: true, name: true, durationMs: true },
      } },
    } } } },
    orderBy: { startAt: 'asc' }, take: 2,
  });
  res.setHeader('Cache-Control', 'no-store');
  const cursor=resolveRadioCursor(slots,now.getTime());
  const dj=cursor.status==='IDLE' && !cursor.slot ? await getAutoDj():null;
  const active=dj?.enabled?autoDjCursor(dj.tracks,now.getTime()):null;
  res.json({ timezone:'Europe/Moscow',
    cursor:active?{status:'AUTO_DJ',at:now.toISOString(),slot:null,track:active}:cursor });
}));

router.get('/agent/snapshot', deviceAuth, safe(async(req,res) => {
  const from=new Date(Date.now()-3600000), to=new Date(Date.now()+14*86400000);
  const slots=await prisma.radioScheduleSlot.findMany({ where:{ startAt:{lt:to}, endAt:{gt:from},playlist:{status:'APPROVED'} },
    include:{playlist:{include:{items:{orderBy:{position:'asc'},include:{asset:true}}}}},
    orderBy:{startAt:'asc'},take:500 });
  const entries=slots.map(slot=>({ id:slot.id,startAt:slot.startAt.toISOString(),endAt:slot.endAt.toISOString(),
    playlistId:slot.playlistId,playlistName:slot.playlist.name,
    tracks:slot.playlist.items.map(({asset})=>({id:asset.id,name:asset.name,sha256:asset.sha256,
      byteSize:asset.byteSize,durationMs:asset.durationMs,url:'/api/radio-agent/agent/assets/'+asset.id})) }));
  const dj=await getAutoDj();
  const autoDj={enabled:dj.enabled,playlistId:dj.playlistId,
    tracks:dj.tracks.map(autoDjTrack)};
  const json=JSON.stringify({entries,autoDj});
  const revision=digest(json);
  res.setHeader('Cache-Control','no-store');
  res.json({ revision, generatedAt:new Date().toISOString(),timezone:'Europe/Moscow',mode:req.radioDevice.playbackAllowed ? 'PILOT' : 'SYNC_ONLY',
    playbackEnabled:!!req.radioDevice.playbackAllowed, slots:entries,autoDj });
}));
router.get('/agent/assets/:id', deviceAuth, safe(async(req,res) => {
  // Allow only files currently referenced in the approved schedule.
  const start=new Date(Date.now()-3600000),end=new Date(Date.now()+14*86400000);
  const use=await prisma.radioPlaylistItem.findFirst({ where:{assetId:req.params.id,
    playlist:{status:'APPROVED',slots:{some:{startAt:{lt:end},endAt:{gt:start}}}}} });
  if(!use) {
    const dj=await getAutoDj();
    if(!dj.enabled || !dj.tracks.some(asset=>asset.id===req.params.id))
      return res.status(404).json({error:'Запись не включена в разрешённую эфирную сетку'});
  }
  const asset=await prisma.radioAsset.findUnique({where:{id:req.params.id}});
  if(!asset) return res.status(404).json({error:'Запись не найдена'});
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Type','application/octet-stream');
  res.sendFile(path.join(assetsRoot,path.basename(asset.storageKey)));
}));
// Local executor telemetry is observability only: it never unlocks START,
// changes an alarm state or attests that a physical PA speaker is silent.
router.post('/agent/mchs-playback-session-status',deviceAuth,safe(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!process.env.MCHS_AGENT_LAB_DEVICE_ID||
    req.radioDevice.id!==process.env.MCHS_AGENT_LAB_DEVICE_ID)
  return res.status(403).json({error:'DEVICE_NOT_BOUND'});
 const report=normalizeMchsAgentPlaybackReport(req.body);
 if(!report.accepted)
  return res.status(400).json({error:report.reason});
 const key='mchs_agent_playback_session_status_v1_'+req.radioDevice.id;
 const value=JSON.stringify({...report.value,reportedAt:new Date().toISOString(),
  localProcessStateOnly:true,physicalPaOutputVerified:false,
  automaticPublicBroadcastAuthorized:false});
 await prisma.setting.upsert({where:{key},create:{key,value},update:{value}});
 res.json({accepted:true,localProcessStateOnly:true,publicPlaybackAuthorized:false});
}));
// Event-scoped local headphones observation. This endpoint does not
// unlock START, advance an emergency state, or attest physical PA delivery.
router.post('/agent/mchs-event-execution-observation',deviceAuth,safe(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!process.env.MCHS_AGENT_LAB_DEVICE_ID||
    req.radioDevice.id!==process.env.MCHS_AGENT_LAB_DEVICE_ID)
  return res.status(403).json({error:'DEVICE_NOT_BOUND'});
 const report=normalizeMchsEventExecutionObservation(req.body);
 if(!report.accepted)return res.status(400).json({error:report.reason});
 const key='mchs_agent_event_execution_observation_v1_'+req.radioDevice.id;
 const historyKey='mchs_agent_event_execution_history_v1_'+req.radioDevice.id;
 await prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581476)`;
  const existing=await tx.setting.findUnique({where:{key:historyKey}});
  const history=appendMchsExecutionObservation(
    readMchsExecutionObservationHistory(existing?.value),report.value,new Date().toISOString());
  await tx.setting.upsert({where:{key:historyKey},create:{key:historyKey,value:JSON.stringify(history)},
     update:{value:JSON.stringify(history)}});
  const value=JSON.stringify({...report.value,receivedAt:history[history.length-1].receivedAt});
  await tx.setting.upsert({where:{key},create:{key,value},update:{value}});
 });
 res.json({accepted:true,localProcessObservationOnly:true,
  physicalPaOutputVerified:false,publicPlaybackAuthorized:false});
}));
// Existing admin workspace reads local evidence. This does not provide a
// second incident journal, issue a command, or attest output in PA.
router.get('/mchs-agent-event-execution-observations',...admin,safe(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 const deviceId=process.env.MCHS_AGENT_LAB_DEVICE_ID;
 if(!deviceId)return res.json({bound:false,items:[],localOnly:true});
 const key='mchs_agent_event_execution_history_v1_'+deviceId;
 const legacyKey='mchs_agent_event_execution_observation_v1_'+deviceId;
 const [row,legacy]=await Promise.all([
  prisma.setting.findUnique({where:{key}}),
  prisma.setting.findUnique({where:{key:legacyKey}})
 ]);
 const items=mergeLegacyMchsExecutionObservation(
  readMchsExecutionObservationHistory(row?.value),legacy?.value)
  .sort((a,b)=>Date.parse(b.receivedAt)-Date.parse(a.receivedAt));
 res.json({bound:true,items,localOnly:true,
  hasStoredAgentObservation:!!legacy?.value||items.length>0,
  newestObservationAt:items[0]?.receivedAt||null,
  physicalPaOutputVerified:false,publicPlaybackAuthorized:false});
}));
// Read-only loopback self-test for explicitly bound headphones pilot devices.
// There is no command queue, no public output, no arbitrary asset ID or URL.
router.get('/agent/mchs-headphones-self-test.wav',deviceAuth,safe(async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 if(!process.env.MCHS_AGENT_LAB_DEVICE_ID||
    req.radioDevice.id!==process.env.MCHS_AGENT_LAB_DEVICE_ID)
  return res.status(403).json({error:'DEVICE_NOT_BOUND'});
 if(process.env.MCHS_AGENT_HEADPHONES_SELF_TEST_ENABLED!=='true')
  return res.status(404).json({error:'SELF_TEST_DISABLED'});
 try{
  const wav=await fetchIsolatedHeadphonesSelfTest();
  res.setHeader('Content-Type','audio/wav');
  res.setHeader('Content-Disposition','attachment; filename="headphones-self-test.wav"');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Length',String(wav.length));
  return res.send(wav);
 }catch(error){
  console.warn('MCHS_HEADPHONES_SELF_TEST_UNAVAILABLE',error?.message);
  return res.status(503).json({error:'SELF_TEST_UNAVAILABLE'});
 }
}));
// Device-authenticated, ALARM-only asset delivery; never exposes an arbitrary
// file path or changes playback. Production event START remains separately held.
router.get('/agent/mchs-alarm-assets/:id',deviceAuth,safe(async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');
  if(!process.env.MCHS_AGENT_LAB_DEVICE_ID||
     req.radioDevice.id!==process.env.MCHS_AGENT_LAB_DEVICE_ID)
    return res.status(403).json({error:'DEVICE_NOT_BOUND'});
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(req.params.id))
    return res.status(400).json({error:'INVALID_ASSET_ID'});
  const asset=await prisma.radioAsset.findFirst({
    where:{id:req.params.id,category:'ALARM',mimeType:{startsWith:'audio/'}}});
  if(!asset)return res.status(404).json({error:'ALARM_ASSET_NOT_FOUND'});
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Type','application/octet-stream');
  return res.sendFile(path.join(assetsRoot,path.basename(asset.storageKey)));
}));
export default router;
