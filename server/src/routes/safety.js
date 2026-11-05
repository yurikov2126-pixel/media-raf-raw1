import {assessMchsDispatchQueue} from '../lib/mchsDispatchQueueReadiness.js';
import {assessMchsTrialStopConfirmation} from '../lib/mchsTrialStopConfirmation.js';
import {assessMchsLiveAcceptance} from '../lib/mchsLiveAcceptanceGate.js';
import {assessMchsIntegrationProbe} from '../lib/mchsIntegrationProbe.js';
import {assessMchsTransportChain} from '../lib/mchsTransportChainDiagnostics.js';
import {MCHS_DISPATCH_PROTOCOL_KEY,normalizeMchsDispatchProtocol,stageMchsDispatchCommand,recordMchsDispatchDryRunAck,haltMchsDispatchProtocol} from '../lib/mchsDispatchProtocol.js';
import {assessMchsAgentDispatchTelemetry} from '../lib/mchsAgentDispatchTelemetry.js';
import {MCHS_ANDROID_INTENTS_KEY,normalizeAndroidIntents} from '../lib/mchsAndroidIntentLedger.js';
import {assessMchsNaturalCompletion} from '../lib/mchsNaturalCompletionEvidence.js';
import {assessMchsStationResume} from '../lib/mchsStationResumeEvidence.js';
import {assessMchsLiveAudioPreflight} from '../lib/mchsLiveAudioPreflight.js';
import {bindAndroidAlarmCandidates,stageBoundAndroidIntents} from '../lib/mchsAndroidAlarmBinding.js';
import {buildMchsDryRunExecution} from '../lib/mchsAutomaticExecutionDryRun.js';
import {MCHS_MONITOR_KEY,normalizeAndroidMonitor,observeAndroidEvents} from '../lib/mchsAndroidObservationMonitor.js';
import {reconcilePersistedAlarmAfterRestart,MCHS_SEEN_EVENT_IDS_KEY,recordAndroidEventId} from '../lib/mchsExecutionRecovery.js';
import {MCHS_EXECUTION_JOURNAL_KEY,normalizeExecutionJournal,appendExecutionJournal,recoverExecutionJournal} from '../lib/mchsExecutionJournal.js';
import {MCHS_ALARM_REPEATS_KEY,DEFAULT_DANGER_REPEATS,validateDangerRepeats,normalizeDangerRepeats} from '../lib/mchsAlarmRepeats.js';
import {normalizeMchsTypeRepeats,validateMchsTypeRepeats,buildMchsTypeAudioPreview} from '../lib/mchsTypeAudioPlan.js';
import {assessMchsLiveTrialPreflight} from '../lib/mchsLiveTrialPreflight.js';
import {assessMissileExecutionInterlock} from '../lib/mchsExecutionInterlock.js';
import {assessMchsDeliveryReceipts} from '../lib/mchsDeliveryReceipts.js';
import {assessMchsDualChannelTransition} from '../lib/mchsDualChannelTransition.js';
import {assessMchsTwoChannelSession} from '../lib/mchsTwoChannelSession.js';
import {advanceMchsSessionLifecycle} from '../lib/mchsSessionLifecycle.js';
import {normalizeMchsEventReceipt} from '../lib/mchsEventReceiptEvidence.js';
import {advanceMchsReceiptLedger} from '../lib/mchsReceiptLedger.js';
import crypto from 'node:crypto';
import {mchsLabFixtureRequest} from '../lib/mchsLabFixtureProxy.js';
import http from 'node:http';
import {fetchMchsWorkerLabChunk} from '../lib/mchsWorkerLabAudioProxy.js';
import {workerMchsSessionRequest} from '../lib/mchsWorkerLabSessionProxy.js';
import {trainingStreamRequest} from '../lib/mchsTrainingStreamProxy.js';
import {runTrainingSequence} from '../lib/mchsTrainingSequence.js';
import {stopAndVerifyMchsWorker} from '../lib/mchsWorkerStopVerification.js';
import {sendMchsDryRunReceipt} from '../lib/mchsWorkerReceiptProxy.js';
import {fetchWorkerMchsLabWav} from '../lib/mchsWorkerLabProxy.js';
import { mchsAnalyzerPublicStatus, MCHS_ANALYZER_HEALTH_KEY } from '../lib/mchsAnalyzerHealth.js';
import { summarizeMchsDelivery } from '../lib/mchsDeliveryDiagnostics.js';
import { assessMchsRetryBacklog } from '../lib/mchsRetryBacklog.js';
import { getIo } from '../lib/notify.js';
import { Router } from 'express';
import {makeEmergencyTestWav} from '../lib/mchsIsolatedAudioPreview.js';
import {makeIsolatedHandoverWav} from '../lib/mchsIsolatedHandoverWav.js';
import {workerRequest} from '../lib/radioLiveOpusGateway.js';
import {planRadioEmergencyResume} from '../lib/radioEmergencyResumePlan.js';
import {assessEmergencyAudioTestReadiness} from '../lib/mchsAudioTestReadiness.js';
import {runEmergencySimulationSuite,runEmergencySimulationScenario} from '../lib/mchsEmergencySimulationSuite.js';
import { auth, requireRole } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { hasPermission } from '../lib/roles.js';
import { classifyMchsObservation, MCHS_EVENT_TYPES } from '../lib/mchsClassification.js';
import {assessMissileAutoEvent,missileNextState} from '../lib/mchsMissileAutoGate.js';
import {classifyAutomaticAlarmCandidate} from '../lib/mchsAutomaticAlarmCandidate.js';
import {evaluateAndroidMissileSequence} from '../lib/mchsAndroidSingleSource.js';
import {planMchsAndroidAlarmEvent} from '../lib/mchsAndroidAlarmPlanner.js';
import {dispatchNewAndroidStationBindings} from '../lib/mchsAndroidStationBridge.js';
import {requestMchsStationSession} from '../lib/mchsStationWorkerTransport.js';
import {assessMchsMainStationReadiness} from '../lib/mchsMainStationReadiness.js';
import {MCHS_ESP32_TRANSITIONS_KEY,assessEsp32TransitionEvidence} from '../lib/mchsEsp32TransitionEvidence.js';
import {selectNextMchsStationIntent,settleMchsStationAttempt} from '../lib/mchsStationSequentialQueue.js';
import {reconcileMchsStationClaims} from '../lib/mchsStationClaimRecovery.js';
import {MCHS_STATION_RECEIPTS_KEY,normalizeStationReceipts,registerStationDispatch,reconcileStationReceiptHistory} from '../lib/mchsStationExecutionReceipts.js';
import {fetchRegionalOfficialFeed,REGIONAL_OFFICIAL_FEED_URL} from '../lib/mchsRegionalOfficialFeed.js';
import {correlateMissileBulletins} from '../lib/mchsBulletinCorrelation.js';
import {buildCorrelationReview,MCHS_CORRELATION_REVIEW_KEY} from '../lib/mchsCorrelationReview.js';
import {MISSILE_CHECKPOINT_KEY,emptyMissileCheckpoint,normalizeMissileCheckpoint,advanceMissileCheckpoint} from '../lib/mchsMissileCheckpoint.js';
import {planMissilePlayback} from '../lib/mchsMissilePlaybackPlan.js';
import {planMissileAlarmTransition} from '../lib/mchsMissileAlarmTransition.js';
import {runIsolatedMissileAlarmPcmTrial} from '../lib/mchsMissileIsolatedPcmTrial.js';
import {MCHS_EXECUTION_POLICY_KEY,normalizeMchsExecutionPolicy,assessMchsExecutionReadiness} from '../lib/mchsExecutionControl.js';
import { inspectMchsObservationOrder } from '../lib/mchsObservationOrder.js';
import { assessMchsQueueObservation } from '../lib/mchsQueueAssessment.js';

const router = Router();

/** Automatically monitor stored Android observations. Never actuate radio. */
let mchsMonitorRunning=false;
async function tickMchsAndroidMonitor(){
 if(mchsMonitorRunning)return;
 mchsMonitorRunning=true;
 try{
  const outcome=await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581451)`;
   const [row,observations]=await Promise.all([
    tx.setting.findUnique({where:{key:MCHS_MONITOR_KEY}}),
    tx.safetyMchsEvent.findMany({where:{source:'MCHS_ANDROID'},
     orderBy:{receivedAt:'desc'},take:150,
     select:{id:true,title:true,body:true,source:true,verified:true,sourceEventId:true,region:true,occurredAt:true,receivedAt:true}})
   ]);
   let saved;try{saved=JSON.parse(row?.value||'null');}catch{}
   const result=observeAndroidEvents(normalizeAndroidMonitor(saved),observations);
   let addedDispatchIntents=[];
   if(result.newEntries.length){
    const [intentRow,repeatRow,ruleRow,assets]=await Promise.all([
     tx.setting.findUnique({where:{key:MCHS_ANDROID_INTENTS_KEY}}),
     tx.setting.findUnique({where:{key:MCHS_ALARM_REPEATS_KEY}}),
     tx.setting.findUnique({where:{key:'mchs_four_type_rules_v1'}}),
     tx.radioAsset.findMany({where:{category:'ALARM',mimeType:{startsWith:'audio/'}},
      select:{id:true,category:true,mimeType:true,durationMs:true}})
    ]);
    let savedIntents,rawRules;
    try{savedIntents=JSON.parse(intentRow?.value||'null');}catch{}
    try{rawRules=JSON.parse(ruleRow?.value||'{}');}catch{}
    const bound=bindAndroidAlarmCandidates({
     entries:result.newEntries,observations,assets,
     rules:rawRules||{},dangerRepeats:normalizeDangerRepeats(
      Number(repeatRow?.value||DEFAULT_DANGER_REPEATS))
    });
    // Staging only: no official-source attestation or dispatch authorization.
    const staged=stageBoundAndroidIntents(savedIntents,bound.eligible);
    addedDispatchIntents=staged.added;
    if(staged.added.length)await tx.setting.upsert({where:{key:MCHS_ANDROID_INTENTS_KEY},
     create:{key:MCHS_ANDROID_INTENTS_KEY,value:JSON.stringify(staged.ledger)},
     update:{value:JSON.stringify(staged.ledger)}});
   }
   if(result.newEntries.length||!row)await tx.setting.upsert({where:{key:MCHS_MONITOR_KEY},
    create:{key:MCHS_MONITOR_KEY,value:JSON.stringify(result.state)},
    update:{value:JSON.stringify(result.state)}});
   return {...result,dispatchIntents:addedDispatchIntents,observations};
  });
  // Do not replay stored Android notifications after process restart.
  // Live START requires three independent configuration gates.
  // Select and claim at most one fresh persisted intent per monitor tick.
  // The database claim prevents a concurrent API process from issuing the same START.
  let selected=null;
  let recoveredDispatches=[];
  if(process.env.MCHS_ANDROID_MAIN_STATION_DISPATCH_ENABLED==='true'){
   let workerStatus=null;
   try{workerStatus=await requestMchsStationSession({action:'STATUS'});}
   catch(error){console.warn('MCHS_STATION_QUEUE_STATUS_FAILED',error.message);}
   selected=await prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581453)`;
    const row=await tx.setting.findUnique({where:{key:MCHS_ANDROID_INTENTS_KEY}});
    let saved;try{saved=JSON.parse(row?.value||'null');}catch{}
    const recovered=reconcileMchsStationClaims(saved?.items,workerStatus,{nowMs:Date.now()});
    recoveredDispatches=recovered.recovered;
    const {items,changed,candidate,blocked}=selectNextMchsStationIntent({
     ...saved,items:recovered.items},{workerStatus,nowMs:Date.now()});
    if(candidate){
     const chosen=items.find(item=>item.eventId===candidate.eventId);
     chosen.status='DISPATCHING';chosen.claimedAt=new Date().toISOString();
     chosen.attempts=(chosen.attempts||0)+1;
    }
    if(recovered.changed||changed||candidate)await tx.setting.upsert({where:{key:MCHS_ANDROID_INTENTS_KEY},
     create:{key:MCHS_ANDROID_INTENTS_KEY,value:JSON.stringify({...saved,items})},
     update:{value:JSON.stringify({...saved,items})}});
    if(blocked)return null;
    return candidate?items.find(item=>item.eventId===candidate.eventId):null;
   });
  }
  let dispatched={results:[...recoveredDispatches]};
  if(selected){
   // The durable intent can outlive the monitor's recent-150-event window.
   const original=await prisma.safetyMchsEvent.findUnique({where:{id:selected.eventId},
    select:{id:true,source:true,sourceEventId:true,verified:true,region:true,occurredAt:true}});
   const attempts=await dispatchNewAndroidStationBindings({
    intents:[{...selected,status:'STAGED'}],
    observations:original?[original]:[],enabled:true,request:requestMchsStationSession
   });
   // A transient BUSY response stays queued; do not register it as a final receipt.
   dispatched={results:[...recoveredDispatches,...attempts.results.filter(r=>
    !(r.httpStatus===409&&r.reason==='STATION_SOURCE_BUSY')&&
    !['WORKER_TIMEOUT','WORKER_TRANSPORT_ERROR','NO_WORKER_RESULT','WORKER_UNCONFIRMED'].includes(r.reason))]};
   const result=attempts.results[0]||{ok:false,reason:'NO_WORKER_RESULT',eventId:selected.eventId};
   await prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581453)`;
    const row=await tx.setting.findUnique({where:{key:MCHS_ANDROID_INTENTS_KEY}});
    let saved;try{saved=JSON.parse(row?.value||'null');}catch{}
    const items=(saved?.items||[]).map(item=>item.eventId===selected.eventId&&
     item.status==='DISPATCHING'?settleMchsStationAttempt(item,{
      ok:result.ok,httpStatus:result.httpStatus,
      data:{reason:result.reason},reason:result.reason
     }):item);
    await tx.setting.update({where:{key:MCHS_ANDROID_INTENTS_KEY},
     data:{value:JSON.stringify({...saved,items})}});
   });
  }
  if(dispatched.results.length){
   await prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581452)`;
    const row=await tx.setting.findUnique({where:{key:MCHS_STATION_RECEIPTS_KEY}});
    let previous;try{previous=JSON.parse(row?.value||'null');}catch{}
    const ledger=registerStationDispatch(previous,dispatched.results);
    await tx.setting.upsert({where:{key:MCHS_STATION_RECEIPTS_KEY},
     create:{key:MCHS_STATION_RECEIPTS_KEY,value:JSON.stringify(ledger)},
     update:{value:JSON.stringify(ledger)}});
   });
  }
  // Always reconcile pending PCM evidence, including when no new Android event arrived.
  // GET/status remains read-only even when live START is disabled.
  try{
   const status=await requestMchsStationSession({action:'STATUS'});
   await prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581452)`;
    const row=await tx.setting.findUnique({where:{key:MCHS_STATION_RECEIPTS_KEY}});
    if(!row)return;
    let previous;try{previous=JSON.parse(row.value||'null');}catch{}
    const outcome=reconcileStationReceiptHistory(previous,status);
    if(outcome.changed)await tx.setting.update({where:{key:MCHS_STATION_RECEIPTS_KEY},
     data:{value:JSON.stringify(outcome.ledger)}});
   });
  }catch(error){
   console.warn('MCHS_STATION_RECEIPT_POLL_FAILED',JSON.stringify({reason:error.message}));
  }
  if(dispatched.results.length)console.info('MCHS_ANDROID_STATION_DISPATCH',JSON.stringify({
   results:dispatched.results
  }));
  if(outcome.newEntries.length)console.info('MCHS_ANDROID_AUTOMATIC_OBSERVATION',JSON.stringify({
   count:outcome.newEntries.length,decisions:outcome.newEntries.map(x=>({
    eventId:x.eventId,eventType:x.eventType,result:x.result,reason:x.reason}))}));
 }catch(error){console.error('MCHS_ANDROID_MONITOR_FAILED',JSON.stringify({reason:error.message}));}
 finally{mchsMonitorRunning=false;}
}
const mchsMonitorTimer=setInterval(()=>{void tickMchsAndroidMonitor();},15000);
mchsMonitorTimer.unref?.();
setImmediate(()=>{void tickMchsAndroidMonitor();});

const KEY = 'safety_mchs_config_v1';
const defaults = Object.freeze({
  enabled: false,
  testMode: true,
  destinations: { radio: true, speakers: true },
  region: 'Тульская область',
  androidHostLabel: 'mchs-android',
  notes: '',
});
const auditKey = 'safety_mchs_config_history_v1';
const denied = (res) => res.status(403).json({ error: 'Нет прав на управление оповещениями' });

async function canView(req, res, next) {
  try {
    if (await hasPermission(req.user, 'safety.view')) return next();
    return denied(res);
  } catch (error) { return next(error); }
}
function sanitize(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (typeof value.enabled !== 'boolean' || typeof value.testMode !== 'boolean') return null;
  if (!value.destinations || typeof value.destinations.radio !== 'boolean' || typeof value.destinations.speakers !== 'boolean') return null;
  if (typeof value.region !== 'string' || value.region.length > 120 || typeof value.notes !== 'string' || value.notes.length > 500) return null;
  // Phase 1 must never enable live automation, even through a forged API request.
  if (value.enabled || !value.testMode) return null;
  return { ...defaults, enabled: false, testMode: true,
    destinations: { radio: value.destinations.radio, speakers: value.destinations.speakers },
    region: value.region.trim(), notes: value.notes.trim() };
}
async function load() {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  try {
    const saved = JSON.parse(row?.value || '{}');
    return { ...defaults, ...saved, enabled: false, testMode: true,
      destinations: { ...defaults.destinations, ...saved?.destinations } };
  } catch { return defaults; }
}
router.use(auth);
router.get('/mchs-training-stream/assets',requireRole('ADMIN'),async (_req,res,next)=>{
 try{const assets=await prisma.radioAsset.findMany({where:{category:'ALARM',mimeType:{startsWith:'audio/'}},select:{id:true,name:true,durationMs:true},orderBy:{createdAt:'desc'},take:200});res.set('Cache-Control','no-store').json({assets});}
 catch(error){next(error);}
});
/** Operator-confirmed real-stream training ONLY; never called by ingestion or automation. */
let mchsTrainingSequenceSession=null;
const sequencePublicStatus=()=>mchsTrainingSequenceSession&&({
 id:mchsTrainingSequenceSession.id,status:mchsTrainingSequenceSession.status,
 stage:mchsTrainingSequenceSession.stage,startedAt:mchsTrainingSequenceSession.startedAt,
 finishedAt:mchsTrainingSequenceSession.finishedAt,
 result:mchsTrainingSequenceSession.result||null
});
router.get('/mchs-training-sequence/status',requireRole('ADMIN'),(_req,res)=>{
 res.set('Cache-Control','no-store').json({session:sequencePublicStatus()});
});
router.post('/mchs-training-sequence/stop',requireRole('ADMIN'),async(_req,res)=>{
 const session=mchsTrainingSequenceSession;
 if(!session||session.status!=='RUNNING')return res.status(409).json({error:'NO_RUNNING_SEQUENCE'});
 session.abort.abort();
 // Stop immediately rather than waiting for the next poll to notice cancellation.
 const result=await stopAndVerifyMchsWorker({request:trainingStreamRequest});
 if(!result.confirmed){
  console.error('MCHS_TRAINING_STOP_UNCONFIRMED',JSON.stringify({
   sessionId:session.id,reason:result.reason,attempts:result.attempts}));
  return res.status(503).set('Cache-Control','no-store').json({
   ok:false,error:'STOP_NOT_CONFIRMED',reason:result.reason,
   stopConfirmed:false,session:sequencePublicStatus()});
 }
 res.set('Cache-Control','no-store').json({
  ok:true,stopConfirmed:true,session:sequencePublicStatus()});
});
/** Operator configurable repeats; a setting alone never triggers broadcast. */
router.get('/mchs-alarm-repeats',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const row=await prisma.setting.findUnique({where:{key:MCHS_ALARM_REPEATS_KEY}});
  res.set('Cache-Control','no-store').json({dangerRepeats:normalizeDangerRepeats(Number(row?.value||DEFAULT_DANGER_REPEATS)),clearRepeats:1,
   automaticPlaybackEnabled:false});
 }catch(error){next(error);}
});
router.put('/mchs-alarm-repeats',requireRole('ADMIN'),async (req,res,next)=>{
 try{
  const count=req.body?.dangerRepeats;
  if(!validateDangerRepeats(count))return res.status(400).json({error:'DANGER_REPEATS_OUT_OF_RANGE',min:1,max:5});
  await prisma.setting.upsert({where:{key:MCHS_ALARM_REPEATS_KEY},
   create:{key:MCHS_ALARM_REPEATS_KEY,value:String(count)},update:{value:String(count)}});
  res.set('Cache-Control','no-store').json({dangerRepeats:count,clearRepeats:1,automaticPlaybackEnabled:false});
 }catch(error){next(error);}
});
/** Starts a detached operator-only sequence; HTTP/browser lifecycle never stops audio. */
router.post('/mchs-training-sequence',requireRole('ADMIN'),async(req,res,next)=>{
 try{
  if(req.body?.confirmation!=='TRAINING_AUDIO_OUTPUT_ACKNOWLEDGED')
   return res.status(400).json({error:'EXPLICIT_CONFIRMATION_REQUIRED'});
  const {dangerAssetId,clearAssetId,dangerRepeats}=req.body||{};
  if(dangerRepeats!==undefined&&!validateDangerRepeats(dangerRepeats))
   return res.status(400).json({error:'DANGER_REPEATS_OUT_OF_RANGE',min:1,max:5});
  if(typeof dangerAssetId!=='string'||typeof clearAssetId!=='string'||dangerAssetId===clearAssetId)
   return res.status(400).json({error:'INVALID_ASSET_SELECTION'});
  if(mchsTrainingSequenceSession?.status==='RUNNING')
   return res.status(409).json({error:'TRAINING_SEQUENCE_BUSY'});
  const assets=await prisma.radioAsset.findMany({where:{id:{in:[dangerAssetId,clearAssetId]},category:'ALARM',
   mimeType:{startsWith:'audio/'}},select:{id:true,durationMs:true}});
  if(assets.length!==2)return res.status(400).json({error:'ALARM_ASSET_NOT_FOUND'});
  // One asset may have a long runtime: duration is bounded by the existing Worker timeout.
  const session={id:crypto.randomBytes(12).toString('hex'),status:'RUNNING',stage:'STARTING',
   startedAt:new Date().toISOString(),finishedAt:null,result:null,abort:new globalThis.AbortController()};
  mchsTrainingSequenceSession=session;
  res.status(202).set('Cache-Control','no-store').json({ok:true,session:sequencePublicStatus()});
  const repeatRow=await prisma.setting.findUnique({where:{key:MCHS_ALARM_REPEATS_KEY}});
  void runTrainingSequence({dangerAssetId,clearAssetId,request:trainingStreamRequest,
   dangerRepeats:dangerRepeats===undefined?
    normalizeDangerRepeats(Number(repeatRow?.value||DEFAULT_DANGER_REPEATS)):dangerRepeats,
   signal:session.abort.signal,pollMs:750,maxWaitMs:300000,
   onProgress:progress=>{session.stage=progress.stage+':'+progress.status;}})
   .then(result=>{
    session.result=result;
    session.status=result.ok?'COMPLETED':'FAILED';
    session.finishedAt=new Date().toISOString();
    console.info('MCHS_MANUAL_AUDIO_SEQUENCE',JSON.stringify({operatorId:req.user?.id||null,
     sessionId:session.id,ok:result.ok,reason:result.reason}));
   }).catch(error=>{
    session.result={ok:false,reason:error.message||'UNEXPECTED_ERROR'};
    session.status='FAILED';session.finishedAt=new Date().toISOString();
    console.error('MCHS_MANUAL_AUDIO_SEQUENCE_FAILED',JSON.stringify({sessionId:session.id,reason:session.result.reason}));
   });
 }catch(error){next(error);}
});
router.get('/mchs-training-stream',requireRole('ADMIN'),async (_req,res)=>{
 try{const r=await trainingStreamRequest();res.status(r.httpStatus).set('Cache-Control','no-store').json(r.data);}
 catch{res.status(503).json({error:'TRAINING_WORKER_UNAVAILABLE'});}
});
router.post('/mchs-training-stream',requireRole('ADMIN'),async (req,res)=>{
 const action=req.body?.action;
 if(!['START','STOP'].includes(action))return res.status(400).json({error:'INVALID_ACTION'});
 if(action==='STOP'){
  const stop=await stopAndVerifyMchsWorker({request:trainingStreamRequest});
  return res.status(stop.confirmed?200:503).set('Cache-Control','no-store').json({
   ok:stop.confirmed,stopConfirmed:stop.confirmed,reason:stop.reason,
   ...(!stop.confirmed?{error:'STOP_NOT_CONFIRMED'}:{})});
 }
 try{const r=await trainingStreamRequest(action,req.body?.assetId);res.status(r.httpStatus).set('Cache-Control','no-store').json(r.data);}
 catch{res.status(503).json({error:'TRAINING_WORKER_UNAVAILABLE'});}
});

// No actual control commands are accepted here. Pure in-process diagnostics only.
// Read-only worker health; distinct from simulator success and physical output verification.
// Real schedule snapshot + worker status, READ ONLY. No emergency commands, no playout.
// Conservative production preflight: never accepts a client claim that hardware is isolated.
// Download-only synthetic chime; does not touch Radio Worker or PA hardware.
// Static offline audio handover demonstration; no access to the station mixer.
// Server-side control plane for the *isolated* Worker lab only; no station PCM output.
// Read-only live laboratory PCM proxy; never connects to station output.
// Training files are short, ephemeral and never connected to station playback.
router.get('/worker-lab/fixtures',canView,async (_req,res)=>{
 try{const r=await mchsLabFixtureRequest();res.status(r.status).set('Cache-Control','no-store').json(r.data);}
 catch{res.status(503).json({error:'Worker fixture status unavailable'});}
});
router.delete('/worker-lab/fixtures',canView,async (_req,res)=>{
 try{const r=await mchsLabFixtureRequest({method:'DELETE'});res.status(r.status).end();}
 catch{res.status(503).json({error:'Worker fixture clear unavailable'});}
});
router.post('/worker-lab/fixtures/:kind',canView,async (req,res)=>{
 if(!['music','trainingVoice'].includes(req.params.kind))return res.status(400).end();
 if(req.headers['content-type']?.split(';')[0]!=='audio/wav')return res.status(415).end();
 const size=Number(req.headers['content-length']);
 if(!Number.isInteger(size)||size<44||size>480044)return res.status(413).end();
 let bytes=0,parts=[],failed=false;
 req.on('data',chunk=>{
  if(failed)return;
  bytes+=chunk.length;
  if(bytes>480044){failed=true;parts=[];res.status(413).end();req.resume();return;}
  parts.push(chunk);
 });
 req.on('end',async()=>{
  if(failed)return;
  if(bytes!==size)return res.status(400).end();
  try{const r=await mchsLabFixtureRequest({method:'POST',kind:req.params.kind,data:Buffer.concat(parts)});
   res.status(r.status).set('Cache-Control','no-store').json(r.data||{error:'Invalid laboratory WAV'});}
  catch{res.status(503).json({error:'Worker fixture upload unavailable'});}
 });
});
router.get('/worker-lab/session/stream.pcm',canView,(req,res)=>{
 const port=Number(process.env.RADIO_PLAYOUT_PORT||4105);
 const secret=process.env.RADIO_PLAYOUT_SECRET||'';
 if(!Number.isInteger(port)||port<1||port>65535||secret.length<32)return res.status(503).json({error:'Worker unavailable'});
 const upstream=http.get({hostname:'127.0.0.1',port,path:'/mchs-lab/session/stream.pcm',
  headers:{'x-radio-worker-secret':secret},timeout:4000},source=>{
  if(source.statusCode!==200){source.resume();res.status(503).end();return;}
  upstream.setTimeout(0);
  res.set({'Content-Type':'application/octet-stream','Cache-Control':'no-store, no-transform',
   'X-Content-Type-Options':'nosniff','X-Accel-Buffering':'no','X-Lab-Format':'s16le;rate=24000;channels=1'});
  source.pipe(res);
  source.on('error',()=>res.destroy());
 });
 upstream.on('timeout',()=>upstream.destroy(new Error('WORKER_TIMEOUT')));
 upstream.on('error',()=>{if(!res.headersSent)res.status(503).end();else res.destroy();});
 req.on('close',()=>upstream.destroy());
 res.on('close',()=>upstream.destroy());
});
router.get('/worker-lab/session/audio.wav',canView,async (_req,res)=>{
 try{
  const {wav,phase}=await fetchMchsWorkerLabChunk();
  res.set({'Content-Type':'audio/wav','Content-Length':String(wav.length),'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff','X-Lab-Phase':phase}).end(wav);
 }catch{res.status(503).set('Cache-Control','no-store').json({error:'Lab audio unavailable'});}
});
router.get('/worker-lab/session',canView,async (_req,res)=>{
 try{const result=await workerMchsSessionRequest();res.set('Cache-Control','no-store').json(result.data);}
 catch{res.status(503).json({error:'Worker lab session unavailable'});}
});
router.post('/worker-lab/session',canView,async (req,res)=>{
 const action=req.body?.action;
 if(!['START','INTERRUPT','RESUME','STOP'].includes(action))return res.status(400).json({error:'Invalid action'});
 try{const result=await workerMchsSessionRequest(action);res.set('Cache-Control','no-store').status(result.httpStatus).json(result.data);}
 catch{res.status(503).json({error:'Worker lab session unavailable'});}
});
router.get('/worker-lab/handover.wav',canView,async (req,res)=>{
 const scenario=typeof req.query.scenario==='string'?req.query.scenario:'resume';
 if(!['resume','stop','repeat'].includes(scenario))return res.status(400).json({error:'Invalid lab scenario'});
 try{
  const wav=await fetchWorkerMchsLabWav({scenario});
  res.set({'Content-Type':'audio/wav','Content-Length':String(wav.length),'Cache-Control':'no-store'});
  res.end(wav);
 }catch(err){
  // Diagnostic categories only: never expose worker secrets, ports or internal addresses.
  const reason=err?.message||'';
  const code=reason==='WORKER_NOT_CONFIGURED'?'WORKER_NOT_CONFIGURED':
    reason==='WORKER_HTTP_403'?'WORKER_AUTH_FAILED':
    reason==='WORKER_HTTP_404'?'WORKER_ROUTE_MISSING':
    reason==='WORKER_TIMEOUT'||reason==='ETIMEDOUT'?'WORKER_TIMEOUT':
    reason==='ECONNREFUSED'||reason==='ECONNRESET'||reason==='EHOSTUNREACH'?'WORKER_UNREACHABLE':
    reason==='LAB_WAV_TOO_LARGE'||reason==='INVALID_WORKER_AUDIO'?'WORKER_INVALID_AUDIO':
    'WORKER_REQUEST_FAILED';
  console.warn('MCHS_WORKER_LAB_FAILURE',code);
  res.set('Cache-Control','no-store').status(503).json({error:'Worker lab unavailable',code});
 }
});
router.get('/isolated-handover.wav',canView,(_req,res)=>{
 const wav=makeIsolatedHandoverWav();
 res.set({'Content-Type':'audio/wav','Content-Length':String(wav.length),
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
 'Content-Disposition':'attachment; filename="mchs-isolated-handover.wav"'});
 res.end(wav);
});
router.get('/isolated-test-tone.wav', canView, (_req,res) => {
  const data=makeEmergencyTestWav();
  res.set({'Content-Type':'audio/wav','Content-Length':String(data.length),
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
    'Content-Disposition':'attachment; filename="mchs-isolated-test.wav"'});
  res.end(data);
});
router.get('/audio-test-readiness', canView, async (_req,res,next) => {
  try {
    const now=new Date();
    const [workerResult,slots]=await Promise.all([
      workerRequest('GET','/health').then(value=>({ok:true,value})).catch(()=>({ok:false,value:null})),
      prisma.radioScheduleSlot.findMany({
        where:{startAt:{lte:now},endAt:{gt:now},playlist:{status:'APPROVED'}},
        include:{playlist:{include:{items:{orderBy:{position:'asc'},include:{asset:{
          select:{id:true,name:true,durationMs:true}
        }}}}}},orderBy:{startAt:'asc'},take:5
      })
    ]);
    const worker=workerResult.value;
    const verdict=assessEmergencyAudioTestReadiness({
      workerReachable:workerResult.ok,workerSource:worker?.mode||'UNKNOWN',
      workerError:worker?.lastError||null,nowMs:now.getTime(),slots
      // No server-side evidence yet for isolation, stop, rollback or supervised tests.
    });
    res.set('Cache-Control','no-store');
    res.json({checkedAt:now.toISOString(),source:worker?.mode||'UNKNOWN',...verdict});
  }catch(error){next(error);}
});
router.get('/radio-resume-diagnostic', canView, async (_req,res,next) => {
  try {
    const at=new Date();
    const [slots,workerResult]=await Promise.all([
      prisma.radioScheduleSlot.findMany({
        where:{startAt:{lte:at},endAt:{gt:at},playlist:{status:'APPROVED'}},
        include:{playlist:{include:{items:{orderBy:{position:'asc'},include:{asset:{
          select:{id:true,name:true,durationMs:true}
        }}}}}},orderBy:{startAt:'asc'},take:5
      }),
      workerRequest('GET','/health').then(value=>({ok:true,value}))
        .catch(()=>({ok:false,value:null}))
    ]);
    const worker=workerResult.value;
    const source=workerResult.ok?String(worker?.mode||'UNKNOWN'):'UNKNOWN';
    const plan=workerResult.ok?planRadioEmergencyResume({
      source,nowMs:at.getTime(),slots,previousTrackId:worker?.trackId||null,
      // Live and playlist authority cannot be proven by health alone.
      liveConnected:false,liveAuthorized:false,playlistActive:false
    }):{ready:false,action:'RECHECK_STATION_AUTHORITY',reason:'WORKER_UNAVAILABLE',simulationOnly:true};
    res.set('Cache-Control','no-store');
    res.json({checkedAt:at.toISOString(),workerReachable:workerResult.ok,
      currentSource:source,workerTrackId:worker?.trackId||null,workerSlotId:worker?.slotId||null,
      scheduledSlotIds:slots.map(x=>x.id),plan,
      liveAuthorityVerified:false,playlistAuthorityVerified:false,
      simulationOnly:true,programRestorationVerified:false,audioOutputVerified:false,playbackChanged:false});
  }catch(error){next(error);}
});
router.get('/radio-worker-readiness', canView, async (_req,res) => {
  res.set('Cache-Control','no-store');
  try {
    const worker=await workerRequest('GET','/health');
    const source=String(worker?.mode||'UNKNOWN');
    const recognized=['AUTO_DJ','SCHEDULE','LIVE','MANUAL_PLAYLIST','AUTO_PLAYLIST'].includes(source);
    res.json({reachable:true,source,sourceRecognized:recognized,trackId:worker?.trackId||null,
      slotId:worker?.slotId||null,nextTrackId:worker?.nextTrackId||null,
      frames:Number.isFinite(worker?.frames)?worker.frames:null,
      lastError:worker?.lastError||null,connected:worker?.connected??null,
      startedAt:worker?.startedAt||null,
      emergencySimulation:worker?.emergencySimulation?.mode==='DRY_RUN_ONLY'?'DRY_RUN_ONLY':null,
      programRestorationVerified:false,audioOutputVerified:false,amplifierVerified:false,
      diagnosticOnly:true,playbackChanged:false});
  } catch(error) {
    res.status(503).json({reachable:false,reason:'WORKER_HEALTH_UNAVAILABLE',diagnosticOnly:true,
      programRestorationVerified:false,audioOutputVerified:false,amplifierVerified:false});
  }
});
router.get('/emergency-simulation', canView, (req,res) => {
  const source=String(req.query.source||'');
  const result=source?runEmergencySimulationScenario(source):runEmergencySimulationSuite();
  res.set('Cache-Control','no-store');
  res.status(result.ok===false?400:200).json(result);
});
router.get('/access', canView, (_req, res) => res.json({ allowed: true, canConfigure: _req.user.role === 'ADMIN' }));
router.get('/dashboard', canView, async (_req, res, next) => {
  try {
    const config = await load();
    res.set('Cache-Control', 'no-store');
    const [events, count, health, diagnostics, diagnosticCount] = await Promise.all([
      prisma.safetyMchsEvent.findMany({ orderBy: { receivedAt: 'desc' }, take: 50, select: {
        id: true, source: true, receivedAt: true, occurredAt: true, title: true,
        body: true, channelId: true, region: true, eventType: true, verified: true,
      } }),
      prisma.safetyMchsEvent.count(),
      prisma.safetyMchsHealth.findUnique({ where: { id: 'mchs-android' } }),
      prisma.safetyMchsDiagnostic.findMany({ orderBy: { receivedAt: 'desc' }, take: 20, select: { id: true, eventId: true, receivedAt: true } }),
      prisma.safetyMchsDiagnostic.count(),
    ]);
    const lastSeenMs = health?.lastSeenAt ? new Date(health.lastSeenAt).getTime() : null;
    const online = lastSeenMs !== null && Date.now() - lastSeenMs < 180000;
    res.json({
      config,
      source: { name: 'МЧС России / Android', connection: online ? 'HEARTBEAT_RECENT' : health ? 'HEARTBEAT_STALE' : 'NOT_CONFIGURED', lastSeen: health?.lastSeenAt || null, listener: online ? health.listener : 'UNVERIFIED', push: online ? health.push : 'UNVERIFIED' },
      integration: {
        status: process.env.MCHS_INGEST_ENABLED === 'true' ? 'OBSERVATION_RECEIVER_ENABLED' : 'DISABLED',
        receiverConfigured: process.env.MCHS_INGEST_ENABLED === 'true' && (process.env.MCHS_INGEST_HMAC_KEY || '').length >= 32,
        deliveryVerified: count > 0,
        deliveryMode: 'MANUAL_CONFIRMED_AUTOMATIC_UNVERIFIED',
        lastReceivedAt: events[0]?.receivedAt || null,
        automaticDeliveryVerified: false,
      },
      events,
      diagnosticEvents: diagnostics,
      diagnosticCount,
      diagnosticIngestEnabled: process.env.MCHS_DIAGNOSTIC_ENABLED === 'true' && (process.env.MCHS_DIAGNOSTIC_HMAC_KEY || '').length >= 32,
      eventCount: count,
      eventHistoryAvailable: true,
      liveActivationAvailable: false,
      message: count > 0 ? 'Исторические уведомления Android поступали в журнал. Автоматическая доставка и подлинность сообщений не подтверждены.' : 'События Android пока не поступали. Пустой журнал не означает отсутствия предупреждений МЧС.',
    });
  } catch (error) { next(error); }
});
router.get('/events', canView, async (req, res, next) => {
  try {
    const take = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
    const events = await prisma.safetyMchsEvent.findMany({
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }], take,
      select: { id: true, source: true, sourceEventId: true, receivedAt: true,
        occurredAt: true, title: true, body: true, channelId: true, region: true,
        eventType: true, verified: true }
    });
    res.set('Cache-Control', 'no-store');
    res.json({ events, ingestionEnabled: process.env.MCHS_INGEST_ENABLED === 'true' });
  } catch (error) { next(error); }
});

/**
 * Operator-only policy drafts. Deliberately never consumed by ingest,
 * dispatch, radio or any scheduled job. Default is OFF for every event.
 */
const POLICY_KEY = 'mchs_notification_policy_drafts_v1';
const policyModes = new Set(['IGNORE', 'REVIEW']);
async function policies() {
  const stored = await prisma.setting.findUnique({ where: { key: POLICY_KEY } });
  try {
    const value = JSON.parse(stored?.value || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
router.get('/notification-policy-drafts', canView, async (_req, res, next) => {
  try {
    const [rules, assets] = await Promise.all([
      policies(),
      prisma.radioAsset.findMany({
        where: { mimeType: { startsWith: 'audio/' }, category: 'ALARM' },
        select: { id: true, name: true, durationMs: true, category: true },
        orderBy: { createdAt: 'desc' }, take: 200,
      }),
    ]);
    res.set('Cache-Control', 'no-store');
    return res.json({ rules, assets, liveDispatchEnabled: false,
      description: 'Настройки для анализа и предварительного выбора. Ни одна запись не запускает радио.' });
  } catch (error) { next(error); }
});
router.put('/notification-policy-drafts/:eventId', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const event = await prisma.safetyMchsEvent.findUnique({ where: { id: req.params.eventId },
      select: { id: true, sourceEventId: true } });
    if (!event) return res.status(404).json({ error: 'EVENT_NOT_FOUND' });
    const { mode, audioAssetId, note } = req.body || {};
    if (!policyModes.has(mode) || typeof note !== 'string' || note.length > 500 ||
        (audioAssetId !== null && audioAssetId !== undefined && (typeof audioAssetId !== 'string' || audioAssetId.length > 120))) {
      return res.status(400).json({ error: 'INVALID_POLICY' });
    }
    if (audioAssetId) {
      const asset = await prisma.radioAsset.findUnique({ where: { id: audioAssetId }, select: { mimeType: true, category: true } });
      if (!asset?.mimeType?.startsWith('audio/') || asset.category !== 'ALARM') return res.status(400).json({ error: 'AUDIO_ASSET_NOT_FOUND' });
    }
    // A single JSON document serializes per-event choices; concurrent edits use an
    // advisory PostgreSQL transaction lock to prevent lost updates.
    const entry = { mode, audioAssetId: audioAssetId || null, note: note.trim(),
      updatedAt: new Date().toISOString(), updatedBy: req.user.id, executable: false };
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581420)`;
      const row = await tx.setting.findUnique({ where: { key: POLICY_KEY } });
      let existing = {};
      try { const parsed = JSON.parse(row?.value || '{}'); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) existing = parsed; } catch {}
      existing[event.id] = entry;
      await tx.setting.upsert({ where: { key: POLICY_KEY },
        create: { key: POLICY_KEY, value: JSON.stringify(existing) },
        update: { value: JSON.stringify(existing) } });
    });
    res.set('Cache-Control', 'no-store');
    res.json({ saved: true, eventId: event.id, rule: entry, liveDispatchEnabled: false });
  } catch (error) { next(error); }
});


const TYPE_RULE_KEY = 'mchs_four_type_rules_v1';
const emptyTypeRule = () => ({ mode: 'IGNORE', audioAssetId: null, repeats: 1, note: '', executable: false });
async function getTypeRules() {
  const row = await prisma.setting.findUnique({ where: { key: TYPE_RULE_KEY } });
  let stored = {};
  try { const parsed = JSON.parse(row?.value || '{}'); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) stored = parsed; } catch {}
  return Object.fromEntries(MCHS_EVENT_TYPES.map(type => [type.id, { ...emptyTypeRule(), ...(stored[type.id] || {}), repeats: normalizeMchsTypeRepeats(stored[type.id]?.repeats), executable: false }]));
}
/** Read-only Android -> configured ALARM media linkage; no audio dispatch. */
router.get('/android-alarm-bindings',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const [observations,monitorRow,ruleRow,repeatRow,assets,intentRow]=await Promise.all([
   prisma.safetyMchsEvent.findMany({where:{source:'MCHS_ANDROID'},
    orderBy:{receivedAt:'desc'},take:100,
    select:{id:true,title:true,body:true,source:true,sourceEventId:true,
     verified:true,region:true,occurredAt:true,receivedAt:true}}),
   prisma.setting.findUnique({where:{key:MCHS_MONITOR_KEY}}),
   prisma.setting.findUnique({where:{key:TYPE_RULE_KEY}}),
   prisma.setting.findUnique({where:{key:MCHS_ALARM_REPEATS_KEY}}),
   prisma.radioAsset.findMany({where:{category:'ALARM',mimeType:{startsWith:'audio/'}},
    select:{id:true,category:true,mimeType:true,durationMs:true}}),
   prisma.setting.findUnique({where:{key:MCHS_ANDROID_INTENTS_KEY}})
  ]);
  let monitor,rules,intents;
  try{monitor=JSON.parse(monitorRow?.value||'null');}catch{}
  try{rules=JSON.parse(ruleRow?.value||'{}');}catch{}
  try{intents=JSON.parse(intentRow?.value||'null');}catch{}
  const entries=normalizeAndroidMonitor(monitor).entries;
  const bound=bindAndroidAlarmCandidates({entries,observations,rules:rules||{},assets,
   dangerRepeats:normalizeDangerRepeats(Number(repeatRow?.value||DEFAULT_DANGER_REPEATS))});
  res.set('Cache-Control','no-store').json({
   checkedAt:new Date().toISOString(),...bound,
   persistedProposals:Array.isArray(intents?.items)?intents.items.slice(-50):[],
   executionEnabled:false,officialSourceVerified:false,output:'PLANNED_ONLY'
  });
 }catch(error){next(error);}
});
router.get('/event-type-rules', canView, async (_req, res, next) => {
  try {
    const [rules, assets] = await Promise.all([getTypeRules(),
      prisma.radioAsset.findMany({ where: { mimeType: { startsWith: 'audio/' }, category: 'ALARM' },
        select: { id: true, name: true, durationMs: true }, orderBy: { createdAt: 'desc' }, take: 200 })]);
    const recent = await prisma.safetyMchsEvent.findMany({ orderBy: { receivedAt: 'desc' }, take: 100,
      select: { id: true, title: true, body: true, eventType: true } });
    res.set('Cache-Control', 'no-store');
    return res.json({ types: MCHS_EVENT_TYPES, rules, assets, previews:Object.fromEntries(MCHS_EVENT_TYPES.map(type => [type.id,
      buildMchsTypeAudioPreview(rules[type.id],assets.find(asset=>asset.id===rules[type.id]?.audioAssetId))])),
      repeatLimits:{min:1,max:5}, liveDispatchEnabled: false,
      classifications: recent.map(e => ({ id: e.id, type: classifyMchsObservation(e.title, e.body) })) });
  } catch (error) { next(error); }
});
router.put('/event-type-rules/:type', requireRole('ADMIN'), async (req, res, next) => {
  try {
    if (!MCHS_EVENT_TYPES.some(t => t.id === req.params.type)) return res.status(404).json({ error: 'UNKNOWN_TYPE' });
    const { mode, audioAssetId, note, repeats = 1 } = req.body || {};
    if (!['IGNORE', 'REVIEW'].includes(mode) || typeof note !== 'string' || note.length > 500 ||
        (audioAssetId != null && (typeof audioAssetId !== 'string' || audioAssetId.length > 120)) ||
        !validateMchsTypeRepeats(repeats))
      return res.status(400).json({ error: 'INVALID_TYPE_RULE' });
    if (audioAssetId) {
      const asset = await prisma.radioAsset.findUnique({ where: { id: audioAssetId }, select: { mimeType: true, category: true } });
      if (!asset?.mimeType?.startsWith('audio/') || asset.category !== 'ALARM') return res.status(400).json({ error: 'AUDIO_ASSET_NOT_FOUND' });
    }
    const entry = { mode, audioAssetId: audioAssetId || null, repeats, note: note.trim(), executable: false,
      updatedBy: req.user.id, updatedAt: new Date().toISOString() };
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581421)`;
      const row = await tx.setting.findUnique({ where: { key: TYPE_RULE_KEY } });
      let stored = {};
      try { const obj = JSON.parse(row?.value || '{}'); if (obj && typeof obj === 'object' && !Array.isArray(obj)) stored = obj; } catch {}
      stored[req.params.type] = entry;
      await tx.setting.upsert({ where: { key: TYPE_RULE_KEY },
        create: { key: TYPE_RULE_KEY, value: JSON.stringify(stored) },
        update: { value: JSON.stringify(stored) } });
    });
    res.json({ saved: true, rule: entry, liveDispatchEnabled: false });
  } catch (error) { next(error); }
});


/** Dispatch mode staging: never grants access to radio/PA playout. */
const DISPATCH_MODE_KEY = 'mchs_dispatch_mode_staging_v1';
router.get('/dispatch-mode', canView, async (_req, res, next) => {
  try {
    const row = await prisma.setting.findUnique({ where: { key: DISPATCH_MODE_KEY } });
    let mode = 'MANUAL';
    try { const parsed = JSON.parse(row?.value || '{}'); if (['MANUAL','AUTO_SIMULATION'].includes(parsed.mode)) mode = parsed.mode; } catch {}
    res.set('Cache-Control', 'no-store');
    res.json({ mode, realPlaybackEnabled: false, automaticPlaybackEnabled: false, output: 'ISOLATED_SIMULATION_ONLY' });
  } catch (error) { next(error); }
});
router.put('/dispatch-mode', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const mode = req.body?.mode;
    if (!['MANUAL','AUTO_SIMULATION'].includes(mode) || Object.keys(req.body || {}).some(k => k !== 'mode'))
      return res.status(400).json({ error: 'INVALID_DISPATCH_MODE' });
    const entry = { mode, updatedAt: new Date().toISOString(), updatedBy: req.user.id,
      realPlaybackEnabled: false };
    await prisma.setting.upsert({ where: { key: DISPATCH_MODE_KEY },
      create: { key: DISPATCH_MODE_KEY, value: JSON.stringify(entry) },
      update: { value: JSON.stringify(entry) } });
    res.json({ ...entry, automaticPlaybackEnabled: false, output: 'ISOLATED_SIMULATION_ONLY' });
  } catch (error) { next(error); }
});


/** Durable, serialised checkpoint for the two missile notifications only.
 * Admin reconciliation never dispatches audio to Radio Worker or AA-300. */
router.get('/missile-auto-checkpoint',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const row=await prisma.setting.findUnique({where:{key:MISSILE_CHECKPOINT_KEY}});
  let value;try{value=JSON.parse(row?.value||'null');}catch{}
  res.set('Cache-Control','no-store').json({checkpoint:normalizeMissileCheckpoint(value),
   automaticPlaybackEnabled:false,output:'DECISION_ONLY'});
 }catch(error){next(error);}
});
router.post('/missile-auto-checkpoint/reconcile',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const result=await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581439)`;
   const row=await tx.setting.findUnique({where:{key:MISSILE_CHECKPOINT_KEY}});
   let checkpoint;try{checkpoint=JSON.parse(row?.value||'null');}catch{}
   checkpoint=normalizeMissileCheckpoint(checkpoint);
   const [events,ruleRow,assetRows]=await Promise.all([
    tx.safetyMchsEvent.findMany({where:{source:'MCHS_ANDROID',verified:true},
     orderBy:[{occurredAt:'asc'},{id:'asc'}],take:500,
     select:{id:true,source:true,sourceEventId:true,title:true,body:true,region:true,verified:true,occurredAt:true}}),
    tx.setting.findUnique({where:{key:TYPE_RULE_KEY}}),
    tx.radioAsset.findMany({where:{category:'ALARM',mimeType:{startsWith:'audio/'}},select:{id:true}})
   ]);
   let saved={};try{saved=JSON.parse(ruleRow?.value||'{}');}catch{}
   const rules=Object.fromEntries(MCHS_EVENT_TYPES.map(type=>[type.id,{...emptyTypeRule(),...(saved[type.id]||{})}]));
   const evaluated=advanceMissileCheckpoint(checkpoint,events,{rules,assets:new Set(assetRows.map(a=>a.id))});
   await tx.setting.upsert({where:{key:MISSILE_CHECKPOINT_KEY},create:{key:MISSILE_CHECKPOINT_KEY,value:JSON.stringify(evaluated.checkpoint)},update:{value:JSON.stringify(evaluated.checkpoint)}});
   return {...evaluated,decisions:evaluated.decisions.slice(-30)};
  });
  res.set('Cache-Control','no-store').json(result);
 }catch(error){next(error);}
});
/** Real telemetry and saved rules, with no synthetic events or actuation. */
router.get('/missile-live-trial-preflight',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const deviceId=process.env.MCHS_AGENT_LAB_DEVICE_ID||null;
  const [rules,assets,worker,device,stopRow,esp32Row]=await Promise.all([
   getTypeRules(),
   prisma.radioAsset.findMany({where:{category:'ALARM',mimeType:{startsWith:'audio/'}},select:{id:true}}),
   trainingStreamRequest().catch(()=>null),
   deviceId?prisma.radioDevice.findUnique({where:{id:deviceId},select:{id:true,lastSeenAt:true,revokedAt:true,playbackAllowed:true}}):null,
   deviceId?prisma.setting.findUnique({where:{key:'mchs_trial_process_stop_v1_'+deviceId}}):null,
   prisma.setting.findUnique({where:{key:'radio_esp32_status_v1'}})
  ]);
  let stop,esp32;try{stop=JSON.parse(stopRow?.value||'null');}catch{}
  try{esp32=JSON.parse(esp32Row?.value||'null');}catch{}
  const agentConfirmed=!!device&&!device.revokedAt&&device.playbackAllowed===true&&
   Date.now()-new Date(device.lastSeenAt).getTime()<=15000;
  const stopConfirmed=assessMchsTrialStopConfirmation(stop,{deviceBound:!!device}).confirmed===true;
  // Telemetry of an ESP32 does not prove physical isolation or a successful STOP.
  const report=assessMchsLiveTrialPreflight({rules,assets,workerReachable:worker?.httpStatus===200,
   agentConfirmed,stopConfirmed,esp32Ready:false});
  res.set('Cache-Control','no-store').json({...report,checkedAt:new Date().toISOString(),
   esp32TelemetryPresent:!!esp32,physicalIsolationVerified:false});
 }catch(error){next(error);}
});
/** Read-only command preview. Nothing is sent to the Worker or amplifier. */
/** Real Android observations, but audio may be played ONLY in an operator's local browser.
 * No Radio Worker / Agent / PA requests. Does not persist or dispatch.
 */
router.get('/missile-local-audio-trial/candidates',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const [ruleRow,events,assets]=await Promise.all([
   prisma.setting.findUnique({where:{key:TYPE_RULE_KEY}}),
   prisma.safetyMchsEvent.findMany({where:{source:'MCHS_ANDROID'},
    orderBy:{receivedAt:'desc'},take:50,select:{id:true,source:true,sourceEventId:true,
     title:true,body:true,region:true,verified:true,occurredAt:true,receivedAt:true}}),
   prisma.radioAsset.findMany({where:{category:'ALARM',mimeType:{startsWith:'audio/'}},
    select:{id:true,name:true,durationMs:true}})
  ]);
  let saved={};try{saved=JSON.parse(ruleRow?.value||'{}');}catch{}
  const rules=Object.fromEntries(['MISSILE_DANGER','MISSILE_ALL_CLEAR'].map(type=>[
   type,{...emptyTypeRule(),...(saved?.[type]||{})}]));
  const byId=new Map(assets.map(a=>[a.id,a]));
  const candidates=events.map(event=>{
   const decision=assessMissileAutoEvent(event,{rules});
   const asset=byId.get(decision.audioAssetId);
   const allowed=decision.eligible&&!!asset&&Number.isFinite(asset.durationMs)&&asset.durationMs>0;
   return {eventId:event.id,receivedAt:event.receivedAt,eventType:decision.eventType,
    allowed:!!allowed,reason:!decision.eligible?decision.reason:!asset?'ALARM_AUDIO_MISSING':
     !Number.isFinite(asset.durationMs)||asset.durationMs<=0?'ALARM_AUDIO_INVALID':null,
    audioAssetId:allowed?asset.id:null,
    repeats:decision.eventType==='MISSILE_ALL_CLEAR'?1:
     normalizeMchsTypeRepeats(rules[decision.eventType]?.repeats)};
  });
  res.set('Cache-Control','no-store').json({checkedAt:new Date().toISOString(),candidates,
   output:'BROWSER_LOCAL_ONLY',automaticBroadcastEnabled:false,dispatchAuthorized:false});
 }catch(error){next(error);}
});
/** Evaluate latest verified Android event against real Worker and Agent state.
 * No commands are sent to the transport, speaker or amplifier.
 */
router.get('/missile-execution-interlock/latest',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const id=process.env.MCHS_AGENT_LAB_DEVICE_ID||null;
  const [event,checkpointRow,ruleRow,assets,worker,device,stopRow]=await Promise.all([
   prisma.safetyMchsEvent.findFirst({where:{source:'MCHS_ANDROID',verified:true},
    orderBy:{receivedAt:'desc'},select:{id:true,source:true,sourceEventId:true,title:true,body:true,
    region:true,verified:true,occurredAt:true,receivedAt:true}}),
   prisma.setting.findUnique({where:{key:MISSILE_CHECKPOINT_KEY}}),
   prisma.setting.findUnique({where:{key:TYPE_RULE_KEY}}),
   prisma.radioAsset.findMany({where:{category:'ALARM',mimeType:{startsWith:'audio/'}},select:{id:true}}),
   trainingStreamRequest().catch(()=>null),
   id?prisma.radioDevice.findUnique({where:{id},select:{id:true,lastSeenAt:true,revokedAt:true,playbackAllowed:true}}):null,
   id?prisma.setting.findUnique({where:{key:'mchs_trial_process_stop_v1_'+id}}):null
  ]);
  let rawCheckpoint,rawRules,stop;
  try{rawCheckpoint=JSON.parse(checkpointRow?.value||'null');}catch{}
  try{rawRules=JSON.parse(ruleRow?.value||'{}');}catch{}
  try{stop=JSON.parse(stopRow?.value||'null');}catch{}
  const rules=Object.fromEntries(['MISSILE_DANGER','MISSILE_ALL_CLEAR'].map(type=>[
   type,{...emptyTypeRule(),...(rawRules?.[type]||{})}]));
  const decision=event?assessMissileAutoEvent(event,{rules}):null;
  const assetAvailable=!!decision?.audioAssetId&&assets.some(asset=>asset.id===decision.audioAssetId);
  const command=decision?.eligible&&assetAvailable?planMissilePlayback([decision],{rules}).commands[0]:null;
  const checkpoint=normalizeMissileCheckpoint(rawCheckpoint);
  const agentReady=!!device&&!device.revokedAt&&device.playbackAllowed===true&&
   Date.now()-new Date(device.lastSeenAt).getTime()<=15000;
  const stopReady=assessMchsTrialStopConfirmation(stop,{deviceBound:!!device}).confirmed===true;
  const assessment=assessMissileExecutionInterlock({command,sourceEvent:event,checkpoint,
   workerReady:worker?.httpStatus===200,agentReady,stopReady,operatorHold:true});
  res.set('Cache-Control','no-store').json({checkedAt:new Date().toISOString(),eventId:event?.id||null,
   eventType:decision?.eventType||null,decisionReason:decision?.reason||(!assetAvailable?'ALARM_AUDIO_MISSING':null),
   ...assessment});
 }catch(error){next(error);}
});
router.get('/missile-auto-playback-plan',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const [stateRow,ruleRow,events,assets]=await Promise.all([
   prisma.setting.findUnique({where:{key:MISSILE_CHECKPOINT_KEY}}),
   prisma.setting.findUnique({where:{key:TYPE_RULE_KEY}}),
   prisma.safetyMchsEvent.findMany({where:{source:'MCHS_ANDROID',verified:true},
    orderBy:[{occurredAt:'asc'},{id:'asc'}],take:200,
    select:{id:true,source:true,sourceEventId:true,title:true,body:true,region:true,verified:true,occurredAt:true}}),
   prisma.radioAsset.findMany({where:{category:'ALARM',mimeType:{startsWith:'audio/'}},select:{id:true}})
  ]);
  let checkpoint,storedRules;
  try{checkpoint=JSON.parse(stateRow?.value||'null');}catch{}
  try{storedRules=JSON.parse(ruleRow?.value||'{}');}catch{}
  const rules=Object.fromEntries(MCHS_EVENT_TYPES.map(type=>[type.id,{...emptyTypeRule(),...(storedRules?.[type.id]||{})}]));
  const evaluated=advanceMissileCheckpoint(normalizeMissileCheckpoint(checkpoint),events,{
   rules,assets:new Set(assets.map(a=>a.id))});
  res.set('Cache-Control','no-store').json({...planMissilePlayback(evaluated.decisions,{rules}),
   checkpoint:evaluated.checkpoint,blocked:evaluated.decisions.filter(d=>!d.eligible).map(d=>({eventId:d.eventId,reason:d.reason})).slice(-30)});
 }catch(error){next(error);}
});
/** Stage verified missile command intents. Never transmits them to broadcast playout. */
router.post('/missile-auto-intents/stage',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const result=await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581439)`;
   await tx.safetyMchsPlaybackIntent.updateMany({where:{status:'STAGED',createdAt:{lte:new Date(Date.now()-120000)}},data:{status:'EXPIRED',lastError:'STALE_INTENT'}});
   const [stateRow,ruleRow,events,assets]=await Promise.all([
    tx.setting.findUnique({where:{key:MISSILE_CHECKPOINT_KEY}}),
    tx.setting.findUnique({where:{key:TYPE_RULE_KEY}}),
    tx.safetyMchsEvent.findMany({where:{source:'MCHS_ANDROID',verified:true},
     orderBy:[{occurredAt:'asc'},{id:'asc'}],take:500,
     select:{id:true,source:true,sourceEventId:true,title:true,body:true,region:true,verified:true,occurredAt:true}}),
    tx.radioAsset.findMany({where:{category:'ALARM',mimeType:{startsWith:'audio/'}},select:{id:true}})
   ]);
   let state,stored;
   try{state=JSON.parse(stateRow?.value||'null');}catch{}
   try{stored=JSON.parse(ruleRow?.value||'{}');}catch{}
   const rules=Object.fromEntries(MCHS_EVENT_TYPES.map(t=>[t.id,{...emptyTypeRule(),...(stored?.[t.id]||{})}]));
   const evaluated=advanceMissileCheckpoint(normalizeMissileCheckpoint(state),events,{rules,assets:new Set(assets.map(a=>a.id))});
   const staged=[];
   for(const decision of evaluated.decisions.filter(x=>x.eligible)){
    const intent=await tx.safetyMchsPlaybackIntent.upsert({
     where:{eventId:decision.eventId},
     create:{eventId:decision.eventId,eventType:decision.eventType,audioAssetId:decision.audioAssetId,status:'STAGED'},
     update:{},select:{id:true,eventId:true,eventType:true,status:true}});
    staged.push(intent);
   }
   await tx.setting.upsert({where:{key:MISSILE_CHECKPOINT_KEY},
    create:{key:MISSILE_CHECKPOINT_KEY,value:JSON.stringify(evaluated.checkpoint)},
    update:{value:JSON.stringify(evaluated.checkpoint)}});
   return {staged,checkpoint:evaluated.checkpoint};
  });
  res.set('Cache-Control','no-store').json({...result,executionEnabled:false,output:'STAGED_ONLY'});
 }catch(error){next(error);}
});
/** Expiry is a terminal state: this endpoint cannot send audio or restore an expired intent. */
router.post('/missile-auto-intents/expire',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const now=new Date();
  const result=await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581439)`;
   const changed=await tx.safetyMchsPlaybackIntent.updateMany({
    where:{status:'STAGED',createdAt:{lte:new Date(now.getTime()-120000)}},
    data:{status:'EXPIRED',lastError:'STALE_INTENT'}
   });
   return {expiredCount:changed.count};
  });
  res.set('Cache-Control','no-store').json({...result,executionEnabled:false});
 }catch(error){next(error);}
});
/** Administrative protocol rehearsal only: no Worker transport, no sound output. */
/** Reconcile expired leases to a terminal state; never replay after expiry. */
router.post('/missile-auto-intents/reconcile-leases',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const result=await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581439)`;
   const changed=await tx.safetyMchsPlaybackIntent.updateMany({
    where:{status:'LEASED',leaseUntil:{lt:new Date()}},
    data:{status:'EXPIRED',lastError:'LEASE_EXPIRED',leaseToken:null,leaseUntil:null}
   });
   return {expiredCount:changed.count,executionEnabled:false};
  });
  res.set('Cache-Control','no-store').json(result);
 }catch(error){next(error);}
});
router.post('/missile-auto-intents/:id/claim',requireRole('ADMIN'),async (req,res,next)=>{
 try{
  const result=await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581439)`;
   const row=await tx.safetyMchsPlaybackIntent.findUnique({where:{id:req.params.id}});
   if(!row||row.status!=='STAGED')return {ok:false,reason:'NOT_STAGED'};
   if(!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(row.eventType))return {ok:false,reason:'TYPE_NOT_ALLOWED'};
   if(Date.now()-row.createdAt.getTime()>=120000)return {ok:false,reason:'STALE_INTENT'};
   const token=crypto.randomBytes(24).toString('hex');
   const updated=await tx.safetyMchsPlaybackIntent.update({where:{id:row.id},
    data:{status:'LEASED',leaseToken:token,leaseUntil:new Date(Date.now()+15000),attempts:{increment:1}}});
   return {ok:true,id:updated.id,leaseToken:token,leaseUntil:updated.leaseUntil,
    executionEnabled:false,output:'DRY_RUN'};
  });
  res.status(result.ok?200:409).set('Cache-Control','no-store').json(result);
 }catch(error){next(error);}
});
router.post('/missile-auto-intents/:id/ack',requireRole('ADMIN'),async(req,res,next)=>{
 try{
  const token=req.body?.leaseToken;
  if(typeof token!=='string'||!/^[a-f0-9]{48}$/.test(token))return res.status(400).json({error:'INVALID_LEASE_TOKEN'});
  const result=await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581439)`;
   const row=await tx.safetyMchsPlaybackIntent.findUnique({where:{id:req.params.id}});
   if(!row||row.status!=='LEASED'||row.leaseToken!==token)return {ok:false,reason:'INVALID_LEASE'};
   if(!row.leaseUntil||row.leaseUntil.getTime()<Date.now())return {ok:false,reason:'LEASE_EXPIRED'};
   const updated=await tx.safetyMchsPlaybackIntent.update({where:{id:row.id},
    data:{status:'ACKED_DRY_RUN',acknowledgedAt:new Date(),leaseToken:null,leaseUntil:null}});
   return {ok:true,id:updated.id,status:updated.status,executionEnabled:false};
  });
  res.status(result.ok?200:409).set('Cache-Control','no-store').json(result);
 }catch(error){next(error);}
});
/** Explicit administrator-driven dry-run delivery only; does not start ALARM. */
router.post('/missile-auto-intents/:id/deliver-dry-run',requireRole('ADMIN'),async(req,res,next)=>{
 try{
  const token=req.body?.leaseToken;
  if(typeof token!=='string'||!/^[a-f0-9]{48}$/.test(token))
   return res.status(400).json({error:'INVALID_LEASE_TOKEN'});
  const row=await prisma.safetyMchsPlaybackIntent.findUnique({where:{id:req.params.id}});
  if(!row||row.status!=='LEASED'||row.leaseToken!==token||
    !row.leaseUntil||row.leaseUntil.getTime()<=Date.now()||
    Date.now()-row.createdAt.getTime()>=120000||
    !['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(row.eventType))
   return res.status(409).json({error:'INVALID_OR_EXPIRED_LEASE'});
  // A dry-run receipt is not proof of audible playback. The Worker never triggers audio.
  const delivered=await sendMchsDryRunReceipt({
   commandId:row.id,eventType:row.eventType,leaseToken:token});
  const acknowledged=await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581439)`;
   const fresh=await tx.safetyMchsPlaybackIntent.findUnique({where:{id:row.id}});
   if(!fresh||fresh.status!=='LEASED'||fresh.leaseToken!==token||
    !fresh.leaseUntil||fresh.leaseUntil.getTime()<=Date.now())
    return false;
   await tx.safetyMchsPlaybackIntent.update({where:{id:row.id},
    data:{status:'ACKED_DRY_RUN',acknowledgedAt:new Date(),leaseToken:null,leaseUntil:null}});
   return true;
  });
  res.status(acknowledged?200:409).set('Cache-Control','no-store').json({
   delivered:delivered.ok,duplicate:delivered.duplicate,acknowledged,
   playbackStarted:false,executionEnabled:false});
 }catch(error){next(error);}
});
/** Synthetic transport check: never uses MCHS event rows or real playback intents. */
router.post('/missile-transport-smoke',requireRole('ADMIN'),async (req,res)=>{
 try{
  const commandId='smoke-'+crypto.randomBytes(12).toString('hex');
  const leaseToken=crypto.randomBytes(24).toString('hex');
  const first=await sendMchsDryRunReceipt({commandId,eventType:'MISSILE_DANGER',leaseToken});
  const repeat=await sendMchsDryRunReceipt({commandId,eventType:'MISSILE_DANGER',leaseToken});
  const valid=first.ok&&!first.duplicate&&repeat.ok&&repeat.duplicate&&
   first.receipt?.receivedAt===repeat.receipt?.receivedAt;
  const saved=await prisma.safetyMchsSyntheticReceipt.create({data:{commandId,operatorId:req.user?.id||null,status:valid?'ACKED_DRY_RUN':'FAILED',duplicateOk:valid},select:{id:true,status:true,checkedAt:true}});
  console.info('MCHS_SYNTHETIC_TRANSPORT_SMOKE',JSON.stringify({commandId,ok:valid,recordId:saved.id,at:new Date().toISOString()}));
  res.status(valid?200:503).set('Cache-Control','no-store').json({
   ok:valid,commandId,firstReceipt:first.receipt?.status,duplicateDetected:repeat.duplicate,
   checkedAt:new Date().toISOString(),synthetic:true,
   databaseDispatchWritten:false,syntheticReceiptSaved:true,receiptStatus:saved.status,playbackStarted:false,executionEnabled:false});
 }catch(error){
  console.warn('MCHS_SYNTHETIC_TRANSPORT_SMOKE',JSON.stringify({ok:false,reason:error?.message||'TRANSPORT_FAILED'}));
  res.status(503).set('Cache-Control','no-store').json({ok:false,error:'WORKER_RECEIPT_UNAVAILABLE',
   synthetic:true,playbackStarted:false,executionEnabled:false});
 }
});
/** Unified operational status. Fail-closed and read-only for all real playout. */
/** Preview transition priority and schedule resume, without authorizing real alarm audio. */
/** Actual PCM engine integration in isolated memory, not live radio. */
router.post('/missile-alarm-pcm-trial',requireRole('ADMIN'),(_req,res)=>{
 const music=Buffer.alloc(7680,17),danger=Buffer.alloc(7680,36),clear=Buffer.alloc(7680,72);
 const result=runIsolatedMissileAlarmPcmTrial({music,danger,clear});
 console.info('MCHS_ISOLATED_PCM_TRIAL',JSON.stringify({ok:result.ok,resumedNormalPcm:result.resumedNormalPcm,executionEnabled:false}));
 res.status(result.ok?200:503).set('Cache-Control','no-store').json(result);
});
router.get('/missile-alarm-transition-preview',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const [checkpointRow,intents]=await Promise.all([
   prisma.setting.findUnique({where:{key:MISSILE_CHECKPOINT_KEY}}),
   prisma.safetyMchsPlaybackIntent.findMany({orderBy:{createdAt:'desc'},take:15,
    select:{id:true,eventId:true,eventType:true,audioAssetId:true,status:true,createdAt:true}})
  ]);
  let state;try{state=JSON.parse(checkpointRow?.value||'null');}catch{}
  const checkpoint=normalizeMissileCheckpoint(state);
  res.set('Cache-Control','no-store').json({checkpoint,
   transitionPlans:intents.map(command=>({id:command.id,eventType:command.eventType,
    ...planMissileAlarmTransition({state:checkpoint.state,activeEventId:checkpoint.lastEventId,command,operatorHold:true})})),
   executionEnabled:false,output:'PREVIEW_ONLY'});
 }catch(error){next(error);}
});
/** Read-only recovery journal; never starts a Worker or grants dispatch. */
/** Safe, transactional reconciliation; can be invoked by scheduler on startup. */
router.post('/missile-execution-journal/recover-safe',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const result=await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581449)`;
   const row=await tx.setting.findUnique({where:{key:MCHS_EXECUTION_JOURNAL_KEY}});
   let saved;try{saved=JSON.parse(row?.value||'null');}catch{}
   const outcome=reconcilePersistedAlarmAfterRestart(saved);
   if(outcome.changed){
    await tx.setting.upsert({where:{key:MCHS_EXECUTION_JOURNAL_KEY},
     create:{key:MCHS_EXECUTION_JOURNAL_KEY,value:JSON.stringify(outcome.journal)},
     update:{value:JSON.stringify(outcome.journal)}});
   }
   return outcome;
  });
  res.set('Cache-Control','no-store').json(result);
 }catch(error){next(error);}
});
/** Explicit Android message acknowledgement. Records IDs only; never dispatches sound. */
router.post('/missile-android-event-ack',requireRole('ADMIN'),async (req,res,next)=>{
 try{
  const id=req.body?.sourceEventId;
  if(typeof id!=='string'||id.length<1||id.length>200)return res.status(400).json({error:'INVALID_EVENT_ID'});
  const exists=await prisma.safetyMchsEvent.findFirst({
   where:{source:'MCHS_ANDROID',sourceEventId:id},select:{id:true}});
  if(!exists)return res.status(404).json({error:'OBSERVATION_NOT_FOUND'});
  const result=await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581450)`;
   const row=await tx.setting.findUnique({where:{key:MCHS_SEEN_EVENT_IDS_KEY}});
   let saved;try{saved=JSON.parse(row?.value||'[]');}catch{}
   const outcome=recordAndroidEventId(saved,id);
   if(outcome.accepted)await tx.setting.upsert({where:{key:MCHS_SEEN_EVENT_IDS_KEY},
    create:{key:MCHS_SEEN_EVENT_IDS_KEY,value:JSON.stringify(outcome.seen)},
    update:{value:JSON.stringify(outcome.seen)}});
   return outcome;
  });
  res.set('Cache-Control','no-store').json({...result,seenCount:result.seen.length,
   automaticPlaybackEnabled:false,dispatchAuthorized:false});
 }catch(error){next(error);}
});
router.get('/missile-execution-journal',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const row=await prisma.setting.findUnique({where:{key:MCHS_EXECUTION_JOURNAL_KEY}});
  let saved;try{saved=JSON.parse(row?.value||'null');}catch{}
  res.set('Cache-Control','no-store').json({journal:normalizeExecutionJournal(saved),
   dispatchAuthorized:false,automaticPlaybackEnabled:false});
 }catch(error){next(error);}
});
/** Persist a HALT marker and try to stop the existing manual training overlay. */
router.post('/missile-execution-journal/halt',requireRole('ADMIN'),async (req,res,next)=>{
 try{
  const journal=await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581449)`;
   const row=await tx.setting.findUnique({where:{key:MCHS_EXECUTION_JOURNAL_KEY}});
   let saved;try{saved=JSON.parse(row?.value||'null');}catch{}
   const updated=appendExecutionJournal({...normalizeExecutionJournal(saved),state:'HALTED'},
    {action:'OPERATOR_HALT',reason:'ADMIN_REQUEST'});
   await tx.setting.upsert({where:{key:MCHS_EXECUTION_JOURNAL_KEY},
    create:{key:MCHS_EXECUTION_JOURNAL_KEY,value:JSON.stringify(updated)},
    update:{value:JSON.stringify(updated)}});
   return updated;
  });
  if(mchsTrainingSequenceSession?.status==='RUNNING')mchsTrainingSequenceSession.abort.abort();
  let workerStop='NOT_CONFIRMED';
  try{
   const result=await trainingStreamRequest('STOP');
   workerStop=result.httpStatus===200&&result.data?.ok?'CONFIRMED':'NOT_CONFIRMED';
  }catch{/* Persisted hold is authoritative; failed Worker STOP must be visible. */}
  console.warn('MCHS_EXECUTION_OPERATOR_HALT',JSON.stringify({operatorId:req.user?.id||null,workerStop}));
  res.status(workerStop==='CONFIRMED'?200:503).set('Cache-Control','no-store').json({
   journal,workerStop,automaticPlaybackEnabled:false});
 }catch(error){next(error);}
});
/** On-demand restart reconciliation. Never resumes a pending ALARM. */
router.post('/missile-execution-journal/reconcile',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const journal=await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581449)`;
   const row=await tx.setting.findUnique({where:{key:MCHS_EXECUTION_JOURNAL_KEY}});
   let saved;try{saved=JSON.parse(row?.value||'null');}catch{}
   const updated=recoverExecutionJournal(saved);
   await tx.setting.upsert({where:{key:MCHS_EXECUTION_JOURNAL_KEY},
    create:{key:MCHS_EXECUTION_JOURNAL_KEY,value:JSON.stringify(updated)},
    update:{value:JSON.stringify(updated)}});
   return updated;
  });
  res.set('Cache-Control','no-store').json({journal,automaticPlaybackEnabled:false});
 }catch(error){next(error);}
});
router.get('/missile-execution-control',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const [policyRow,checkpointRow,intents]=await Promise.all([
   prisma.setting.findUnique({where:{key:MCHS_EXECUTION_POLICY_KEY}}),
   prisma.setting.findUnique({where:{key:MISSILE_CHECKPOINT_KEY}}),
   prisma.safetyMchsPlaybackIntent.findMany({orderBy:{createdAt:'desc'},take:100,
    select:{id:true,eventId:true,eventType:true,status:true,createdAt:true,updatedAt:true,lastError:true}})
  ]);
  let policy,checkpoint;
  try{policy=JSON.parse(policyRow?.value||'null');}catch{}
  try{checkpoint=JSON.parse(checkpointRow?.value||'null');}catch{}
  res.set('Cache-Control','no-store').json({
   ...assessMchsExecutionReadiness({policy,checkpoint:normalizeMissileCheckpoint(checkpoint),intents}),
   recentIntents:intents.slice(0,15),allowedTypes:['MISSILE_DANGER','MISSILE_ALL_CLEAR'],
   output:'STATUS_ONLY'});
 }catch(error){next(error);}
});
/** Operator emergency hold: always stays locked until authoritative integration exists. */
router.post('/missile-execution-control/hold',requireRole('ADMIN'),async (req,res,next)=>{
 try{
  const policy=normalizeMchsExecutionPolicy({
   operatorHold:true,requestedMode:'DISABLED',lastChangedAt:new Date().toISOString(),
   lastChangedBy:req.user?.id||null,reason:'OPERATOR_HOLD'
  });
  await prisma.setting.upsert({where:{key:MCHS_EXECUTION_POLICY_KEY},
   create:{key:MCHS_EXECUTION_POLICY_KEY,value:JSON.stringify(policy)},
   update:{value:JSON.stringify(policy)}});
  console.info('MCHS_AUTOMATION_OPERATOR_HOLD',JSON.stringify({operatorId:req.user?.id||null,at:policy.lastChangedAt}));
  res.set('Cache-Control','no-store').json({policy,executionEnabled:false});
 }catch(error){next(error);}
});
router.get('/missile-auto-intents',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const intents=await prisma.safetyMchsPlaybackIntent.findMany({orderBy:{createdAt:'desc'},take:100});
  res.set('Cache-Control','no-store').json({intents,executionEnabled:false});
 }catch(error){next(error);}
});
/** Two-event automatic missile policy preview, with strict source/region/freshness gates.
 * Does not authorize or trigger PA output. */
/** Review inbox for automatically received missile alert candidates. No playout access. */
/** Public government bulletin cross-check; read-only, never authorizes broadcast. */
router.get('/missile-correlation-review',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const row=await prisma.setting.findUnique({where:{key:MCHS_CORRELATION_REVIEW_KEY}});
  let saved=null;try{saved=JSON.parse(row?.value||'null');}catch{}
  res.set('Cache-Control','no-store').json({review:saved,dispatchAuthorized:false,automaticPlaybackEnabled:false});
 }catch(error){next(error);}
});
router.post('/missile-correlation-review/refresh',requireRole('ADMIN'),async (req,res)=>{
 let comparisons,sourceAvailable=true,error=null;
 try{
  const [observations,bulletins]=await Promise.all([
   prisma.safetyMchsEvent.findMany({where:{source:'MCHS_ANDROID'},orderBy:{receivedAt:'desc'},take:100,
    select:{id:true,title:true,body:true,source:true,sourceEventId:true,region:true,verified:true,occurredAt:true,receivedAt:true}}),
   fetchRegionalOfficialFeed()]);
  comparisons=correlateMissileBulletins(observations,bulletins);
 }catch(e){sourceAvailable=false;error=e.message;comparisons=[];}
 const review=buildCorrelationReview(comparisons,{sourceAvailable});
 try{
  await prisma.setting.upsert({where:{key:MCHS_CORRELATION_REVIEW_KEY},
   create:{key:MCHS_CORRELATION_REVIEW_KEY,value:JSON.stringify(review)},
   update:{value:JSON.stringify(review)}});
  console.info('MCHS_CORRELATION_REVIEW',JSON.stringify({operatorId:req.user?.id||null,
   checkedAt:review.checkedAt,sourceAvailable,counts:review.counts}));
  res.status(sourceAvailable?200:503).set('Cache-Control','no-store').json({review,error,
   dispatchAuthorized:false,automaticPlaybackEnabled:false});
 }catch(e){res.status(503).json({error:e.message,dispatchAuthorized:false});}
});
router.get('/missile-bulletin-correlation',requireRole('ADMIN'),async (_req,res)=>{
 try{
  const [observations,bulletins]=await Promise.all([
   prisma.safetyMchsEvent.findMany({where:{source:'MCHS_ANDROID'},orderBy:{receivedAt:'desc'},take:100,
    select:{id:true,title:true,body:true,source:true,sourceEventId:true,region:true,verified:true,occurredAt:true,receivedAt:true}}),
   fetchRegionalOfficialFeed()]);
  const comparisons=correlateMissileBulletins(observations,bulletins);
  res.set('Cache-Control','no-store').json({comparisons,bulletinSource:REGIONAL_OFFICIAL_FEED_URL,
   dispatchAuthorized:false,automaticPlaybackEnabled:false,output:'REVIEW_ONLY'});
 }catch(error){res.status(503).set('Cache-Control','no-store').json({
  error:'BULLETIN_CORRELATION_UNAVAILABLE',reason:error.message,
  dispatchAuthorized:false,automaticPlaybackEnabled:false});}
});
router.get('/missile-official-bulletins',requireRole('ADMIN'),async (_req,res)=>{
 try{
  const bulletins=await fetchRegionalOfficialFeed();
  res.set('Cache-Control','no-store').json({source:REGIONAL_OFFICIAL_FEED_URL,
   bulletins,sourceAuthentication:'PUBLIC_CHANNEL_ONLY',dispatchAuthority:false,
   playbackAuthorized:false,output:'REVIEW_ONLY'});
 }catch(error){
  res.status(503).set('Cache-Control','no-store').json({source:REGIONAL_OFFICIAL_FEED_URL,
   error:'OFFICIAL_BULLETIN_UNAVAILABLE',reason:error.message,playbackAuthorized:false,sourcePlatform:'MAX'});
 }
});
/** Automatic decision preview from existing MCHS Android channel, no MAX/Telegram. */
/** Preview what the next qualifying Android event would request. Read-only. */
router.get('/missile-android-playback-preview',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const [events,checkpointRow,repeatRow,rules]=await Promise.all([
   prisma.safetyMchsEvent.findMany({where:{source:'MCHS_ANDROID'},
    orderBy:{occurredAt:'desc'},take:20,
    select:{id:true,title:true,body:true,source:true,verified:true,sourceEventId:true,region:true,occurredAt:true}}),
   prisma.setting.findUnique({where:{key:MISSILE_CHECKPOINT_KEY}}),
   prisma.setting.findUnique({where:{key:MCHS_ALARM_REPEATS_KEY}}),getTypeRules()
  ]);
  let checkpoint;try{checkpoint=JSON.parse(checkpointRow?.value||'null');}catch{}
  const settings={dangerAssetId:rules.MISSILE_DANGER?.audioAssetId,
   clearAssetId:rules.MISSILE_ALL_CLEAR?.audioAssetId,
   dangerRepeats:normalizeDangerRepeats(Number(repeatRow?.value||DEFAULT_DANGER_REPEATS))};
  const previews=events.map(event=>planMchsAndroidAlarmEvent({event,checkpoint,settings}));
  res.set('Cache-Control','no-store').json({settings,previews,
   dispatchAuthorized:false,automaticPlaybackEnabled:false,mode:'PREVIEW_ONLY'});
 }catch(error){next(error);}
});
/** Replay recent Android MCHS events as a dry-run: never sends commands to Radio Worker. */
router.get('/missile-automatic-execution-dry-run',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const [events,rules,repeatRow]=await Promise.all([
   prisma.safetyMchsEvent.findMany({where:{source:'MCHS_ANDROID'},orderBy:{occurredAt:'desc'},take:100,
    select:{id:true,sourceEventId:true,eventType:true,title:true,body:true,source:true,
     verified:true,occurredAt:true,region:true}}),
   getTypeRules(),prisma.setting.findUnique({where:{key:MCHS_ALARM_REPEATS_KEY}})
  ]);
  const observations=events.map(e=>({...e,eventType:classifyMchsObservation(e.title,e.body)}));
  const plan=buildMchsDryRunExecution({observations,rules,
   dangerRepeats:normalizeDangerRepeats(Number(repeatRow?.value||DEFAULT_DANGER_REPEATS))});
  res.set('Cache-Control','no-store').json(plan);
 }catch(error){next(error);}
});
/** Transactional protocol rehearsal. Never dispatches Worker or Agent audio. */
async function mutateMchsDispatchProtocol(change){
 return prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581452)`;
  const row=await tx.setting.findUnique({where:{key:MCHS_DISPATCH_PROTOCOL_KEY}});
  let previous;try{previous=JSON.parse(row?.value||'null');}catch{}
  const outcome=change(previous);
  if(outcome.accepted||outcome.persist){
   await tx.setting.upsert({where:{key:MCHS_DISPATCH_PROTOCOL_KEY},
    create:{key:MCHS_DISPATCH_PROTOCOL_KEY,value:JSON.stringify(outcome.state)},
    update:{value:JSON.stringify(outcome.state)}});
  }
  return outcome;
 });
}
router.get('/missile-dispatch-protocol',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const row=await prisma.setting.findUnique({where:{key:MCHS_DISPATCH_PROTOCOL_KEY}});
  let value;try{value=JSON.parse(row?.value||'null');}catch{}
  res.set('Cache-Control','no-store').json({protocol:normalizeMchsDispatchProtocol(value),automaticPlaybackEnabled:false});
 }catch(error){next(error);}
});
router.post('/missile-dispatch-protocol/stage-dry-run',requireRole('ADMIN'),async (req,res,next)=>{
 try{
  const b=req.body||{};
  const result=await mutateMchsDispatchProtocol(raw=>stageMchsDispatchCommand(raw,{
   commandId:b.commandId,sourceEventId:b.sourceEventId,eventType:b.eventType,createdAt:b.createdAt}));
  res.status(result.accepted?201:409).set('Cache-Control','no-store').json({...result,
   dispatchAuthorized:false,automaticPlaybackEnabled:false});
 }catch(error){next(error);}
});
router.post('/missile-dispatch-protocol/ack-dry-run',requireRole('ADMIN'),async (req,res,next)=>{
 try{
  const b=req.body||{};
  const result=await mutateMchsDispatchProtocol(raw=>{
   const outcome=recordMchsDispatchDryRunAck(raw,{commandId:b.commandId,sourceEventId:b.sourceEventId});
   return {...outcome,persist:outcome.reason==='EXPIRED'};
  });
  res.status(result.accepted?200:409).set('Cache-Control','no-store').json({...result,
   playbackVerified:false,dispatchAuthorized:false,automaticPlaybackEnabled:false});
 }catch(error){next(error);}
});
router.post('/missile-dispatch-protocol/halt',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const result=await mutateMchsDispatchProtocol(raw=>({state:haltMchsDispatchProtocol(raw),persist:true}));
  res.set('Cache-Control','no-store').json({...result,
   workerStop:'NOT_ATTEMPTED',automaticPlaybackEnabled:false});
 }catch(error){next(error);}
});
/** Live read-only check: never invokes Worker START/STOP or any Agent command. */
/** Read-only activation acceptance checklist. Never enables PA or automation. */
router.get('/missile-live-acceptance',requireRole('ADMIN'),(_req,res)=>{
 res.set('Cache-Control','no-store').json(assessMchsLiveAcceptance());
});
/** Live transport evidence without converting heartbeats into event ACKs. */
/** Inspect current event and transport visibility without inventing START/STOP ACKs. */
/** Integrated read-only two-channel acceptance; never infer event playback from trial telemetry. */
/** Full read-only two-channel event lifecycle, never sends audio commands. */
router.get('/missile-session-lifecycle',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const [event,previousRow,protocolRow]=await Promise.all([
   prisma.safetyMchsEvent.findFirst({where:{source:'MCHS_ANDROID',verified:true},
    orderBy:{receivedAt:'desc'},select:{id:true,title:true,body:true,receivedAt:true}}),
   prisma.setting.findUnique({where:{key:'mchs_session_lifecycle_v1'}}),
   prisma.setting.findUnique({where:{key:MCHS_DISPATCH_PROTOCOL_KEY}})
  ]);
  let previous,protocol;try{previous=JSON.parse(previousRow?.value||'null');}catch{}
  try{protocol=JSON.parse(protocolRow?.value||'null');}catch{}
  const eventType=event?classifyMchsObservation(event.title,event.body):null;
  const normalized=normalizeMchsDispatchProtocol(protocol);
  const result=advanceMchsSessionLifecycle(previous,{
   event:{id:event?.id,eventType},halted:true});
  res.set('Cache-Control','no-store').json({...result,checkedAt:new Date().toISOString(),
   haltEpoch:normalized.haltEpoch||null,recorded:false,publicBroadcastAuthorized:false});
 }catch(error){next(error);}
});
/** Event-bound natural completion visibility only; does not dispatch audio.
 * A shared Worker overlay status has no event-bound revision record, so it
 * cannot be used as positive evidence of a genuine emergency broadcast.
 */
/** Observe existing software telemetry after isolated ALARM, without
 * inferring that loudspeakers were audible or changing playout. */
/** Read-only evidence from the actual Worker and the configured Windows Agent.
 * This is not an authorization to start the shared station PCM overlay. */
router.get('/missile-live-audio-preflight',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const deviceId=process.env.MCHS_AGENT_LAB_DEVICE_ID||null;
  const [overlayResult,workerHealth,agentAudioRow]=await Promise.all([
   trainingStreamRequest().catch(()=>null),
   workerRequest('GET','/health').catch(()=>null),
   deviceId?prisma.setting.findUnique({
    where:{key:'radio_agent_audio_v1_'+deviceId}}).catch(()=>null):null
  ]);
  let agentAudio=null;
  try{agentAudio=JSON.parse(agentAudioRow?.value||'null');}catch{}
  const workerOverlay=overlayResult?.httpStatus===200?overlayResult.data:null;
  const assessed=assessMchsLiveAudioPreflight({
   workerHealth,workerOverlay,agentAudio,deviceBound:!!deviceId
  });
  res.set('Cache-Control','no-store').json({
   checkedAt:new Date().toISOString(),...assessed,
   isolatedTrialOnly:true,physicalAudibilityVerified:false
  });
 }catch(error){next(error);}
});
router.get('/missile-station-resume',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const deviceId=process.env.MCHS_AGENT_LAB_DEVICE_ID||null;
  const [workerOverlayResult,stationHealth,agentRow,agentAudioRow]=await Promise.all([
   trainingStreamRequest().catch(()=>null),
   workerRequest('GET','/health').catch(()=>null),
   deviceId?prisma.setting.findUnique({
    where:{key:'mchs_agent_playback_session_status_v1_'+deviceId}}):null,
   deviceId?prisma.setting.findUnique({
    where:{key:'radio_agent_audio_v1_'+deviceId}}):null
  ]);
  let agentReport,agentAudio;
  try{agentReport=JSON.parse(agentRow?.value||'null');}catch{}
  try{agentAudio=JSON.parse(agentAudioRow?.value||'null');}catch{}
  const workerOverlay=workerOverlayResult?.httpStatus===200?workerOverlayResult.data:null;
  const receipt=workerOverlay?.lastTrainingEvent||null;
  const result=assessMchsStationResume({
   eventId:receipt?.eventId||null,
   workerReceipt:receipt,workerOverlay,workerHealth:stationHealth,
   agentReport,agentAudio
  });
  res.set('Cache-Control','no-store').json({
   checkedAt:new Date().toISOString(),...result,
   agentConfigured:!!deviceId,
   isolatedTrainingOnly:true,executionEnabled:false,
   physicalAudibilityVerified:false
  });
 }catch(error){next(error);}
});
router.get('/missile-natural-completion',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const deviceId=process.env.MCHS_AGENT_LAB_DEVICE_ID||null;
  const [intentRow,workerResponse,agentRow]=await Promise.all([
   prisma.setting.findUnique({where:{key:MCHS_ANDROID_INTENTS_KEY}}),
   trainingStreamRequest().catch(()=>null),
   deviceId?prisma.setting.findUnique({
    where:{key:'mchs_agent_playback_session_status_v1_'+deviceId}}):null
  ]);
  let rawIntents,agent;
  try{rawIntents=JSON.parse(intentRow?.value||'null');}catch{}
  try{agent=JSON.parse(agentRow?.value||'null');}catch{}
  const recent=normalizeAndroidIntents(rawIntents).items.slice(-1)[0]||null;
  const intent=recent?{eventId:recent.eventId,eventType:recent.eventType,
   assetId:recent.assetId,repetitions:recent.repetitions}:null;
  const shared=workerResponse?.httpStatus===200?workerResponse.data:null;
  const evaluation=assessMchsNaturalCompletion({intent,agent,
   // The existing shared Worker GET response has no event ID or start
   // revision, and must not be passed off as authoritative event evidence.
   worker:shared});
  res.set('Cache-Control','no-store').json({checkedAt:new Date().toISOString(),
   ...evaluation,workerSharedStatusAvailable:!!shared,
   // Event-bound PCM receipts here are isolated training only; never infer
   // that a real MCHS notification was broadcast from this historical log.
   isolatedTrainingReceipt:shared?.lastTrainingEvent||null,
   isolatedTrainingActiveEvent:shared?.trainingEvent||null,
   agentReportVersion:agent?.version||null,deviceConfigured:!!deviceId,
   executionEnabled:false,physicalAudibilityVerified:false});
 }catch(error){next(error);}
});
router.get('/missile-two-channel-session',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const deviceId=process.env.MCHS_AGENT_LAB_DEVICE_ID||'';
  const [event,worker,device,agentReceiptRow,agentMetadataRow,protocolRow]=await Promise.all([
   prisma.safetyMchsEvent.findFirst({where:{source:'MCHS_ANDROID',verified:true},
    orderBy:{receivedAt:'desc'},select:{id:true,title:true,body:true,region:true,occurredAt:true}}),
   trainingStreamRequest().catch(()=>null),
   deviceId?prisma.radioDevice.findUnique({where:{id:deviceId},select:{
    id:true,lastSeenAt:true,revokedAt:true,playbackAllowed:true}}):null,
   deviceId?prisma.setting.findUnique({where:{key:'mchs_agent_trial_vlc_state_v1_'+deviceId}}):null,
   deviceId?prisma.setting.findUnique({where:{key:'mchs_agent_event_receipt_v1_'+deviceId}}):null,
   prisma.setting.findUnique({where:{key:MCHS_DISPATCH_PROTOCOL_KEY}})
  ]);
  let trial,metadata,protocol;
  try{trial=JSON.parse(agentReceiptRow?.value||'null');}catch{}
  try{metadata=JSON.parse(agentMetadataRow?.value||'null');}catch{}
  try{protocol=JSON.parse(protocolRow?.value||'null');}catch{}
  const eventType=event?classifyMchsObservation(event.title,event.body):null;
  const report=assessMchsTwoChannelSession({event:{id:event?.id,eventType},operatorHold:true});
  const metadataEvidence=normalizeMchsEventReceipt(metadata,{eventId:event?.id,eventType});
  const halt=normalizeMchsDispatchProtocol(protocol);
  const age=Date.now()-new Date(device?.lastSeenAt).getTime();
  res.set('Cache-Control','no-store').json({...report,checkedAt:new Date().toISOString(),
   observations:{workerReachable:worker?.httpStatus===200,
    workerOverlayActive:worker?.httpStatus===200?worker.data?.active===true:null,
    agentHeartbeatCurrent:!!device&&!device.revokedAt&&device.playbackAllowed===true&&
     Number.isFinite(age)&&age>=0&&age<=15000,
    trialVlcState:trial?.state||null,trialIsNotEventPlayback:true,
    agentEventMetadataReceived:!!metadataEvidence.receipt,
    agentEventMetadataReason:metadataEvidence.reason,
    dispatchHaltEpoch:halt.haltEpoch||null,
    workerEventPlaybackAckAvailable:false,agentEventPlaybackAckAvailable:false}});
 }catch(error){next(error);}
});
router.get('/missile-dual-channel-status',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const deviceId=process.env.MCHS_AGENT_LAB_DEVICE_ID||null;
  const [event,worker,device,agentRow]=await Promise.all([
   prisma.safetyMchsEvent.findFirst({where:{source:'MCHS_ANDROID',verified:true},
    orderBy:{receivedAt:'desc'},select:{id:true,title:true,body:true,receivedAt:true}}),
   trainingStreamRequest().catch(()=>null),
   deviceId?prisma.radioDevice.findUnique({where:{id:deviceId},
    select:{id:true,lastSeenAt:true,revokedAt:true,playbackAllowed:true}}):null,
   deviceId?prisma.setting.findUnique({where:{key:'mchs_agent_event_receipt_v1_'+deviceId}}):null
  ]);
  let agentReceipt;try{agentReceipt=JSON.parse(agentRow?.value||'null');}catch{}
  const eventType=event?classifyMchsObservation(event.title,event.body):null;
  const metadata=normalizeMchsEventReceipt(agentReceipt,{eventId:event?.id,eventType});
  // A worker overlay status has no event binding and an agent metadata receipt
  // is not proof of local audio. Neither can be passed as a playback ACK.
  const start=assessMchsDualChannelTransition({eventId:event?.id,eventType,action:'START',
   worker:null,agent:null});
  const stop=assessMchsDualChannelTransition({eventId:event?.id,eventType,action:'STOP',
   worker:null,agent:null});
  const seenAt=new Date(device?.lastSeenAt).getTime();
  const age=Date.now()-seenAt;
  res.set('Cache-Control','no-store').json({checkedAt:new Date().toISOString(),
   eventId:event?.id||null,eventType,workerReachable:worker?.httpStatus===200,
   workerOverlayActive:worker?.httpStatus===200?worker.data?.active===true:null,
   agentConnected:!!device&&!device.revokedAt&&device.playbackAllowed===true&&
    Number.isFinite(age)&&age>=0&&age<=15000,
   agentMetadataReceived:!!metadata.receipt,agentMetadataReason:metadata.reason,
   start,stop,automaticPlaybackEnabled:false,
   reason:'EVENT_SCOPED_PLAYBACK_ACKS_NOT_AVAILABLE'});
 }catch(error){next(error);}
});
router.get('/missile-delivery-observation',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const id=process.env.MCHS_AGENT_LAB_DEVICE_ID||'';
  const [worker,device,observerRow,event,agentEventRow,ledgerRow]=await Promise.all([
   trainingStreamRequest().catch(()=>null),
   id?prisma.radioDevice.findUnique({where:{id},select:{id:true,lastSeenAt:true,revokedAt:true,playbackAllowed:true}}):null,
   id?prisma.setting.findUnique({where:{key:'mchs_agent_observer_v1_'+id}}):null,
   prisma.safetyMchsEvent.findFirst({where:{source:'MCHS_ANDROID',verified:true},
    orderBy:{receivedAt:'desc'},select:{id:true,title:true,body:true,receivedAt:true}}),
   id?prisma.setting.findUnique({where:{key:'mchs_agent_event_receipt_v1_'+id}}):null,
   prisma.setting.findUnique({where:{key:'mchs_receipt_ledger_v1'}})
  ]);
  let observer;try{observer=JSON.parse(observerRow?.value||'null');}catch{}
  const age=Date.now()-Date.parse(observer?.receivedAt||'');
  const agentHeartbeat=!!device&&!device.revokedAt&&device.playbackAllowed===true&&
   Date.now()-new Date(device.lastSeenAt).getTime()>=0&&Date.now()-new Date(device.lastSeenAt).getTime()<=15000;
  const observerFresh=observer?.mode==='OBSERVE_ONLY'&&Number.isFinite(age)&&age>=0&&age<=15000;
  // A fresh heartbeat or Worker read probe is not an event-specific playback receipt.
  // Both remain null until actual event-correlated transport ACK telemetry exists.
  let agentRaw;try{agentRaw=JSON.parse(agentEventRow?.value||'null');}catch{}
  const eventType=event?classifyMchsObservation(event.title,event.body):null;
  const agentEvidence=normalizeMchsEventReceipt(agentRaw,{eventId:event?.id,eventType});
  let ledger;try{ledger=JSON.parse(ledgerRow?.value||'null');}catch{}
  const receiptLedger=agentEvidence.receipt?advanceMchsReceiptLedger(ledger,{...agentEvidence.receipt,channel:'AGENT'}):null;
  const receipts=assessMchsDeliveryReceipts({envelope:null,workerReceipt:null,agentReceipt:agentEvidence.receipt});
  res.set('Cache-Control','no-store').json({checkedAt:new Date().toISOString(),
   eventId:event?.id||null,workerReadProbeOk:worker?.httpStatus===200,
   agentHeartbeatCurrent:agentHeartbeat,agentObserverFresh:observerFresh,
   workerEventReceipt:null,agentEventReceipt:agentEvidence.receipt,agentReceiptReason:agentEvidence.reason,agentReceiptCheck:receiptLedger?{accepted:receiptLedger.accepted,reason:receiptLedger.reason,persisted:false}:null,receipts,
   reason:'EVENT_ACK_TELEMETRY_NOT_IMPLEMENTED',automaticPlaybackEnabled:false,
   publicBroadcastAuthorized:false});
 }catch(error){next(error);}
});
/** Explicit receipt reconciliation: stores only already-observed matching Agent receipts.
 * Never creates a receipt, never issues any playback or control command.
 */
router.post('/missile-delivery-observation/reconcile-agent',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const id=process.env.MCHS_AGENT_LAB_DEVICE_ID||'';
  if(!id)return res.status(409).json({error:'AGENT_NOT_BOUND'});
  const result=await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581479)`;
   const [device,event,receiptRow,ledgerRow]=await Promise.all([
    tx.radioDevice.findUnique({where:{id},select:{id:true,lastSeenAt:true,revokedAt:true,playbackAllowed:true}}),
    tx.safetyMchsEvent.findFirst({where:{source:'MCHS_ANDROID',verified:true},
     orderBy:{receivedAt:'desc'},select:{id:true,title:true,body:true}}),
    tx.setting.findUnique({where:{key:'mchs_agent_event_receipt_v1_'+id}}),
    tx.setting.findUnique({where:{key:'mchs_receipt_ledger_v1'}})
   ]);
   const age=Date.now()-new Date(device?.lastSeenAt).getTime();
   if(!device||device.revokedAt||device.playbackAllowed!==true||!Number.isFinite(age)||age<0||age>15000)
    return {accepted:false,reason:'AGENT_NOT_CURRENT'};
   let raw,ledger;try{raw=JSON.parse(receiptRow?.value||'null');}catch{}
   try{ledger=JSON.parse(ledgerRow?.value||'null');}catch{}
   const eventType=event?classifyMchsObservation(event.title,event.body):null;
   const evidence=normalizeMchsEventReceipt(raw,{eventId:event?.id,eventType});
   if(!evidence.receipt)return {accepted:false,reason:evidence.reason};
   const next=advanceMchsReceiptLedger(ledger,{...evidence.receipt,channel:'AGENT'});
   if(!next.accepted)return {accepted:false,reason:next.reason};
   await tx.setting.upsert({where:{key:'mchs_receipt_ledger_v1'},
    create:{key:'mchs_receipt_ledger_v1',value:JSON.stringify({receipts:next.receipts})},
    update:{value:JSON.stringify({receipts:next.receipts})}});
   return {accepted:true,eventId:event.id,eventType,receiptRecorded:true};
  });
  res.status(result.accepted?200:409).set('Cache-Control','no-store').json({...result,
   playbackStarted:false,automaticPlaybackEnabled:false,publicBroadcastAuthorized:false});
 }catch(error){next(error);}
});
router.get('/missile-integration-probe',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const id=process.env.MCHS_AGENT_LAB_DEVICE_ID||'';
  const [worker,device,observerRow,receiptRow,protocolRow]=await Promise.all([
   trainingStreamRequest().catch(()=>null),
   id?prisma.radioDevice.findUnique({where:{id},select:{
    id:true,lastSeenAt:true,revokedAt:true,playbackAllowed:true}}):Promise.resolve(null),
   id?prisma.setting.findUnique({where:{key:'mchs_agent_observer_v1_'+id}}):Promise.resolve(null),
   id?prisma.setting.findUnique({where:{key:'mchs_agent_halt_seen_v1_'+id}}):Promise.resolve(null),
   prisma.setting.findUnique({where:{key:MCHS_DISPATCH_PROTOCOL_KEY}})
  ]);
  const decode=row=>{try{return JSON.parse(row?.value||'null');}catch{return null;}};
  const report=assessMchsIntegrationProbe({worker,agent:device,observer:decode(observerRow),
   haltReceipt:decode(receiptRow),haltEpoch:normalizeMchsDispatchProtocol(decode(protocolRow)).haltEpoch});
  res.set('Cache-Control','no-store').json({checkedAt:new Date().toISOString(),...report});
 }catch(error){next(error);}
});
router.get('/missile-dispatch-readiness',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  // Bind only the configured pilot device; never accept a caller-supplied device ID.
  const deviceId=process.env.MCHS_AGENT_LAB_DEVICE_ID||null;
  const [row,worker,device,observerRow,trialStopRow,esp32Row]=await Promise.all([
   prisma.setting.findUnique({where:{key:MCHS_ANDROID_INTENTS_KEY}}),
   trainingStreamRequest().catch(()=>null),
   deviceId?prisma.radioDevice.findUnique({where:{id:deviceId},
    select:{id:true,name:true,lastSeenAt:true,revokedAt:true,playbackAllowed:true}}):Promise.resolve(null),
   deviceId?prisma.setting.findUnique({where:{key:'mchs_agent_observer_v1_'+deviceId}}):Promise.resolve(null),
   deviceId?prisma.setting.findUnique({where:{key:'mchs_trial_process_stop_v1_'+deviceId}}):Promise.resolve(null),
   prisma.setting.findUnique({where:{key:'radio_esp32_status_v1'}})
  ]);
  let saved;try{saved=JSON.parse(row?.value||'null');}catch{}
  let observer;try{observer=JSON.parse(observerRow?.value||'null');}catch{}
  let trialStop;try{trialStop=JSON.parse(trialStopRow?.value||'null');}catch{}
  const trialStopConfirmation=assessMchsTrialStopConfirmation(trialStop,{deviceBound:!!device});
  const telemetry=assessMchsAgentDispatchTelemetry(device,observer);
  let esp32Status;try{esp32Status=JSON.parse(esp32Row?.value||'null');}catch{}
  const transportChain=assessMchsTransportChain({workerReachable:worker?.httpStatus===200,
   agentTelemetry:telemetry,trialStop:trialStopConfirmation,esp32Status,deviceId});
  const report=assessMchsDispatchQueue(normalizeAndroidIntents(saved),{
   operatorHold:true,workerReady:worker?.httpStatus===200,agentReady:telemetry.confirmed});
  res.set('Cache-Control','no-store').json({...report,
   workerReachable:worker?.httpStatus===200,agentConfirmed:telemetry.confirmed,
   agentTelemetry:telemetry,trialStopConfirmation,transportChain});
 }catch(error){next(error);}
});
/** Main radio + Windows Agent + ESP32 readiness is observation only.
 * Does not issue START, relay power requests or write to any setting.
 */
router.get('/missile-main-station-readiness',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const deviceId=process.env.MCHS_AGENT_LAB_DEVICE_ID||null;
  const [worker,device,espRow,receiptRow,transitionRow]=await Promise.all([
   requestMchsStationSession({action:'STATUS'}).catch(error=>({
    ok:false,reason:error?.code||'WORKER_UNAVAILABLE'})),
   deviceId?prisma.radioDevice.findUnique({where:{id:deviceId},
    select:{id:true,name:true,lastSeenAt:true,revokedAt:true,playbackAllowed:true}}):Promise.resolve(null),
   prisma.setting.findUnique({where:{key:'radio_esp32_status_v1'}}),
   prisma.setting.findUnique({where:{key:MCHS_STATION_RECEIPTS_KEY}}),
   prisma.setting.findUnique({where:{key:MCHS_ESP32_TRANSITIONS_KEY}})
  ]);
  const parse=row=>{try{return JSON.parse(row?.value||'null');}catch{return null;}};
  const report=assessMchsMainStationReadiness({worker,device,
   esp32Status:parse(espRow),receipts:parse(receiptRow),deviceId,
   flags:{
    dispatch:process.env.MCHS_ANDROID_MAIN_STATION_DISPATCH_ENABLED==='true',
    coordinator:process.env.MCHS_MAIN_STATION_COORDINATOR_ENABLED==='true',
    workerCommands:worker?.data?.enabled===true
   }});
  const transitions=parse(transitionRow);
  res.set('Cache-Control','no-store').json({
   checkedAt:new Date().toISOString(),...report,
   esp32Transitions:assessEsp32TransitionEvidence(transitions,{
    deviceId:Object.entries(transitions?.devices||{}).find(([_,v])=>
     v.reporterId===deviceId)?.[0]||null})
  });
 }catch(error){next(error);}
});
/** Read-only persisted observations: START accepted is not counted as COMPLETE. */
router.get('/missile-station-execution-receipts',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const row=await prisma.setting.findUnique({where:{key:MCHS_STATION_RECEIPTS_KEY}});
  let data;try{data=JSON.parse(row?.value||'null');}catch{}
  res.set('Cache-Control','no-store').json({
   ledger:normalizeStationReceipts(data),readOnly:true,
   workerPcmEvidenceOnly:true,physicalOutputConfirmed:false});
 }catch(error){next(error);}
});
router.get('/missile-android-execution-intents',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const row=await prisma.setting.findUnique({where:{key:MCHS_ANDROID_INTENTS_KEY}});
  let saved;try{saved=JSON.parse(row?.value||'null');}catch{}
  res.set('Cache-Control','no-store').json({ledger:normalizeAndroidIntents(saved),
   dispatchAuthorized:false,automaticPlaybackEnabled:false});
 }catch(error){next(error);}
});
router.get('/missile-android-monitor',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const row=await prisma.setting.findUnique({where:{key:MCHS_MONITOR_KEY}});
  let saved;try{saved=JSON.parse(row?.value||'null');}catch{}
  res.set('Cache-Control','no-store').json({monitor:normalizeAndroidMonitor(saved),
   dispatchAuthorized:false,automaticPlaybackEnabled:false});
 }catch(error){next(error);}
});
router.get('/missile-android-sequence',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const observations=await prisma.safetyMchsEvent.findMany({where:{source:'MCHS_ANDROID'},
   orderBy:{occurredAt:'desc'},take:100,
   select:{id:true,title:true,body:true,source:true,sourceEventId:true,
    region:true,verified:true,occurredAt:true,receivedAt:true}});
  const evaluation=evaluateAndroidMissileSequence(observations);
  res.set('Cache-Control','no-store').json(evaluation);
 }catch(error){next(error);}
});
router.get('/missile-automatic-candidates',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const observations=await prisma.safetyMchsEvent.findMany({
   where:{source:'MCHS_ANDROID'},orderBy:{receivedAt:'desc'},take:100,
   select:{id:true,title:true,body:true,source:true,sourceEventId:true,
    region:true,verified:true,occurredAt:true,receivedAt:true}});
  const candidates=observations.map(event=>({
   ...classifyAutomaticAlarmCandidate(event),
   receivedAt:event.receivedAt,occurredAt:event.occurredAt,
   region:event.region,sourceEventId:event.sourceEventId}));
  res.set('Cache-Control','no-store').json({candidates,officialVerificationAvailable:false,
   automaticPlaybackEnabled:false,output:'REVIEW_ONLY'});
 }catch(error){next(error);}
});
router.get('/missile-auto-readiness',requireRole('ADMIN'),async (_req,res,next)=>{
 try{
  const [events,rules,assetRows]=await Promise.all([
   prisma.safetyMchsEvent.findMany({orderBy:[{receivedAt:'asc'},{id:'asc'}],take:200,
    select:{id:true,source:true,sourceEventId:true,title:true,body:true,region:true,verified:true,occurredAt:true,receivedAt:true}}),
   getTypeRules(),
   prisma.radioAsset.findMany({where:{category:'ALARM',mimeType:{startsWith:'audio/'}},select:{id:true,name:true}})
  ]);
  const assets=new Map(assetRows.map(a=>[a.id,a.name]));
  const seen=new Set();let missileState='CLEAR';
  const decisions=events.map(event=>{
   let result=assessMissileAutoEvent(event,{rules,seenIds:seen});
   if(event.sourceEventId)seen.add(event.sourceEventId);
   if(result.eligible&&!assets.has(result.audioAssetId))
    result={...result,eligible:false,reason:'ALARM_AUDIO_MISSING',audioAssetId:null};
   if(result.eligible){
    const transition=missileNextState(missileState,result.eventType);
    if(transition.accepted)missileState=transition.state;
    else result={...result,eligible:false,reason:transition.reason,audioAssetId:null};
   }
   return {...result,receivedAt:event.receivedAt};
  });
  res.set('Cache-Control','no-store').json({types:['MISSILE_DANGER','MISSILE_ALL_CLEAR'],
   automaticPlaybackEnabled:false,output:'DECISION_ONLY',state:missileState,
   blockedCount:decisions.filter(d=>!d.eligible).length,decisions:decisions.slice(-50).reverse()});
 }catch(error){next(error);}
});
/** Read-only what-would-happen preview: no playback and no dispatch writes. */
router.get('/dispatch-preview', canView, async (_req, res, next) => {
  try {
    const [events, rules, assetRows] = await Promise.all([
      prisma.safetyMchsEvent.findMany({ orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
        take: 100, select: { id: true, title: true, body: true, occurredAt: true,
          receivedAt: true, region: true, sourceEventId: true } }),
      getTypeRules(),
      prisma.radioAsset.findMany({ where: { category: 'ALARM', mimeType: { startsWith: 'audio/' } },
        select: { id: true, name: true } }),
    ]);
    const assets = new Map(assetRows.map(asset => [asset.id, asset.name]));
    const now = Date.now();
    const seen = new Set();
    const decisions = events.map(event => {
      const eventType = classifyMchsObservation(event.title, event.body);
      const rule = rules[eventType];
      const occurred = event.occurredAt ? new Date(event.occurredAt).getTime() : NaN;
      const ageMs = Number.isFinite(occurred) ? now - occurred : null;
      let reason = null;
      if (seen.has(event.sourceEventId)) reason = 'DUPLICATE';
      else if (eventType === 'UNCLASSIFIED') reason = 'UNCLASSIFIED';
      else if (ageMs === null || ageMs < -120000 || ageMs > 120000) reason = 'STALE_OR_UNKNOWN_TIME';
      else if (rule?.mode !== 'REVIEW') reason = 'RULE_DISABLED';
      else if (!rule.audioAssetId || !assets.has(rule.audioAssetId)) reason = 'ALARM_AUDIO_MISSING';
      else if (!event.region || !/ТУЛЬСК/i.test(event.region)) reason = 'REGION_UNVERIFIED';
      seen.add(event.sourceEventId);
      return { eventId: event.id, eventType, occurredAt: event.occurredAt,
        receivedAt: event.receivedAt, ageMs, status: reason ? 'BLOCKED' : 'READY_FOR_OPERATOR_REVIEW',
        reason, audioAssetId: reason ? null : rule.audioAssetId,
        audioName: reason ? null : assets.get(rule.audioAssetId) };
    });
    res.set('Cache-Control', 'no-store');
    res.json({ mode: 'READ_ONLY_PREVIEW', speakerPlaybackEnabled: false,
      evaluatedCount: decisions.length, decisions });
  } catch (error) { next(error); }
});


/** Persisted operator review notes only. No dispatch or speaker actions. */
const REVIEW_KEY = 'mchs_operator_reviews_v1';
router.get('/operator-reviews', canView, async (_req, res, next) => {
  try {
    const row = await prisma.setting.findUnique({ where: { key: REVIEW_KEY } });
    let reviews = {};
    try { const parsed = JSON.parse(row?.value || '{}'); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) reviews = parsed; } catch {}
    res.set('Cache-Control', 'no-store');
    res.json({ reviews, playbackEnabled: false });
  } catch (error) { next(error); }
});
router.put('/operator-reviews/:eventId', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { decision, note } = req.body || {};
    if (!['ACKNOWLEDGED','DISMISSED'].includes(decision) || typeof note !== 'string' ||
        note.trim().length < 3 || note.length > 500 || Object.keys(req.body).some(k => !['decision','note'].includes(k)))
      return res.status(400).json({ error: 'INVALID_REVIEW' });
    const exists = await prisma.safetyMchsEvent.findUnique({ where: { id: req.params.eventId }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: 'EVENT_NOT_FOUND' });
    const entry = { decision, note: note.trim(), reviewedAt: new Date().toISOString(),
      reviewedBy: req.user.id, playbackRequested: false };
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581422)`;
      const row = await tx.setting.findUnique({ where: { key: REVIEW_KEY } });
      let reviews = {};
      try { const parsed = JSON.parse(row?.value || '{}'); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) reviews = parsed; } catch {}
      if (reviews[exists.id]) return;
      reviews[exists.id] = entry;
      await tx.setting.upsert({ where: { key: REVIEW_KEY },
        create: { key: REVIEW_KEY, value: JSON.stringify(reviews) },
        update: { value: JSON.stringify(reviews) } });
    });
    const current = await prisma.setting.findUnique({ where: { key: REVIEW_KEY } });
    const saved = JSON.parse(current?.value || '{}')[exists.id];
    res.set('Cache-Control', 'no-store');
    res.json({ eventId: exists.id, review: saved, alreadyReviewed: saved.reviewedAt !== entry.reviewedAt,
      playbackEnabled: false });
  } catch (error) { next(error); }
});

/** Telemetry only: heartbeat does not prove that no push notifications were missed. */
// Explicit admin-only socket probe. Not an MCHS event or technical incident.
router.post('/technical-notification-probe', requireRole('ADMIN'), async (req,res,next)=>{
  try {
    const since=new Date(Date.now()-60000);
    const recent=await prisma.notification.findMany({
      where:{userId:req.user.id,type:'system',createdAt:{gte:since}},
      select:{payload:true},take:50
    });
    if(recent.some(n=>{try{return JSON.parse(n.payload)?.diagnosticProbe===true;}catch{return false;}}))
      return res.status(429).json({error:'PROBE_COOLDOWN'});
    const payload={
      title:'Проверка уведомлений МЧС · тест',
      message:'Тест доставки Socket.IO. Это НЕ предупреждение МЧС и НЕ неисправность.',
      url:'/app/admin?tab=safety-mchs',diagnosticProbe:true,diagnosticOnly:true,officialAlert:false
    };
    const notification=await prisma.notification.create({
      data:{userId:req.user.id,type:'system',payload:JSON.stringify(payload)}
    });
    getIo()?.to(`user:${req.user.id}`).emit('notification:new',{...notification,payload});
    res.set('Cache-Control','no-store');
    return res.json({ok:true,notificationId:notification.id,socketAvailable:Boolean(getIo()),testOnly:true});
  }catch(error){next(error);}
});
/** Historical diagnostics only; no assertion of push completeness or official alert validity. */
router.get('/analytics', canView, async (req,res,next) => {
  try {
    const days = [7,30,90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const since = new Date(Date.now() - days * 86400000);
    const [events,queues,incidents,reviewsRow] = await Promise.all([
      prisma.safetyMchsEvent.findMany({where:{receivedAt:{gte:since}},
        select:{id:true,receivedAt:true,source:true,eventType:true},orderBy:{receivedAt:'asc'},take:10000}),
      prisma.safetyMchsQueueItem.findMany({where:{createdAt:{gte:since}},
        select:{eventId:true,status:true,createdAt:true,updatedAt:true},take:10000}),
      prisma.safetyMchsTechnicalIncident.findMany({where:{openedAt:{gte:since}},
        select:{kind:true,openedAt:true,resolvedAt:true},take:10000}),
      prisma.setting.findUnique({where:{key:REVIEW_KEY}})
    ]);
    const series=Array.from({length:days},(_,i)=>{
      const date=new Date(since.getTime()+i*86400000).toISOString().slice(0,10);
      return {date,messages:0,analyzed:0,incidents:0,reviews:0};
    });
    const byDay=new Map(series.map(row=>[row.date,row]));
    const add=(at,key)=>{const row=byDay.get(new Date(at).toISOString().slice(0,10));if(row)row[key]++;};
    for(const e of events)add(e.receivedAt,'messages');
    const times=[];
    for(const q of queues){
      if(q.status==='ANALYZED'){add(q.updatedAt,'analyzed');const ms=new Date(q.updatedAt)-new Date(q.createdAt);if(ms>=0&&Number.isFinite(ms))times.push(ms);}
    }
    for(const i of incidents)add(i.openedAt,'incidents');
    let reviews={};try{reviews=JSON.parse(reviewsRow?.value||'{}');}catch{}
    const eventIds=new Set(events.map(e=>e.id));
    let reviewCount=0;
    for(const [id,review] of Object.entries(reviews)){
      if(eventIds.has(id)&&review?.reviewedAt&&new Date(review.reviewedAt)>=since){add(review.reviewedAt,'reviews');reviewCount++;}
    }
    const averageAnalysisMs=times.length?Math.round(times.reduce((a,b)=>a+b,0)/times.length):null;
    res.set('Cache-Control','no-store');
    res.json({days,series,totals:{messages:events.length,analyzed:queues.filter(q=>q.status==='ANALYZED').length,
      pending:queues.filter(q=>q.status==='OBSERVED').length,incidents:incidents.length,
      openIncidents:incidents.filter(i=>!i.resolvedAt).length,reviews:reviewCount,averageAnalysisMs},
      limits:{maxRowsPerTable:10000,truncated:events.length===10000||queues.length===10000||incidents.length===10000},
      scope:'OBSERVED_DIAGNOSTICS_ONLY',officialVerified:false,automaticDeliveryVerified:false,playbackEnabled:false});
  }catch(error){next(error);}
});
router.get('/technical-incidents', canView, async (_req,res,next) => {
  try {
    const rows=await prisma.safetyMchsTechnicalIncident.findMany({
      orderBy:[{openedAt:'desc'},{id:'desc'}],take:100,
      select:{id:true,kind:true,reason:true,openedAt:true,resolvedAt:true}
    });
    res.set('Cache-Control','no-store');
    res.json({items:rows,observationOnly:true,playbackEnabled:false});
  }catch(error){next(error);}
});
// Historical heartbeat snapshots; not proof of push delivery or official alert validity.
// Read-only anomaly assessment of sampled Android VM health. No radio dispatch authority.
router.get('/telemetry-alerts', canView, async (req,res,next) => {
  try {
    const now=Date.now();
    const windowStart=new Date(now-60*60000);
    const [samples,health]=await Promise.all([
      prisma.safetyMchsTelemetrySample.findMany({
        where:{receivedAt:{gte:windowStart}},
        orderBy:{receivedAt:'desc'},take:200,
        select:{receivedAt:true,queuedLocal:true,retryPending:true,failedSends:true,
          telemetryPresent:true,snapshotOk:true}
      }),
      prisma.safetyMchsHealth.findUnique({where:{id:'mchs-android'},
        select:{lastSeenAt:true,telemetryAt:true}})
    ]);
    const alerts=[];
    const latest=samples[0];
    const age=health?.lastSeenAt?now-new Date(health.lastSeenAt).getTime():null;
    if(age===null || age>5*60000)alerts.push({
      code:'HEARTBEAT_GAP',severity:'attention',title:'Нет свежего heartbeat Android VM',
      detail:age===null?'Контакт не зарегистрирован':'Последний контакт '+Math.round(age/60000)+' мин назад',
      since:health?.lastSeenAt||null
    });
    const recent=samples.filter(x=>x.telemetryPresent && now-new Date(x.receivedAt).getTime()<=15*60000);
    if(recent.length>=3){
      const backlog=recent.filter(x=>x.queuedLocal!==null&&x.queuedLocal>=5);
      if(backlog.length>=3)alerts.push({code:'LOCAL_BACKLOG',severity:'attention',
        title:'Устойчивая локальная очередь Android',detail:'Не менее 3 свежих снимков с 5 и более сообщениями',since:backlog[backlog.length-1].receivedAt});
      const retries=recent.filter(x=>x.retryPending!==null&&x.retryPending>0);
      if(retries.length>=3)alerts.push({code:'RETRY_PENDING',severity:'attention',
        title:'Повторные отправки ожидают выполнения',detail:'Повторы отмечены в 3 и более свежих снимках',since:retries[retries.length-1].receivedAt});
      const sqlite=recent.filter(x=>x.snapshotOk===false);
      if(sqlite.length>=3)alerts.push({code:'SQLITE_FAILURE',severity:'attention',
        title:'Повторяющиеся ошибки чтения SQLite',detail:'Не менее 3 отрицательных снимков за 15 минут',since:sqlite[sqlite.length-1].receivedAt});
    }
    const telemetryAge=health?.telemetryAt?now-new Date(health.telemetryAt).getTime():null;
    if(age!==null&&age<=5*60000&&(telemetryAge===null||telemetryAge>10*60000))
      alerts.push({code:'TELEMETRY_STALE',severity:'unknown',title:'Heartbeat есть, но телеметрия устарела',
        detail:'Новые сведения об очереди не поступали более 10 минут',since:health?.telemetryAt||null});
    res.set('Cache-Control','no-store');
    res.json({alerts,checkedAt:new Date(),sampleCount:samples.length,
      status:alerts.some(x=>x.severity==='attention')?'ATTENTION':alerts.length?'UNKNOWN':'NO_DETECTED_ANOMALIES',
      limitations:'Checks operate on recent stored snapshots. A clean result is not proof of delivery.',
      playbackEnabled:false,officialVerified:false});
  }catch(error){next(error);}
});
router.get('/telemetry-history', canView, async (req,res,next) => {
  try {
    const hours=[24,72,168].includes(Number(req.query.hours))?Number(req.query.hours):24;
    const since=new Date(Date.now()-hours*3600000);
    const rows=await prisma.safetyMchsTelemetrySample.findMany({
      where:{receivedAt:{gte:since}},orderBy:{receivedAt:'desc'},take:3000,
      select:{id:true,receivedAt:true,listener:true,push:true,telemetryPresent:true,
        queuedLocal:true,failedSends:true,retryPending:true,oldestPendingAt:true,
        nextRetryAt:true,snapshotOk:true,snapshotAt:true,lastSentAt:true}
    });
    const chronological=rows.reverse();
    res.set('Cache-Control','no-store');
    res.json({hours,items:chronological,truncated:rows.length===3000,
      scope:'ANDROID_HEARTBEAT_TELEMETRY',officialVerified:false,playbackEnabled:false});
  } catch(error){next(error);}
});
router.get('/delivery-diagnostics', canView, async (_req,res,next) => {
  try {
    const [health,lastEvent,pending] = await Promise.all([
      prisma.safetyMchsHealth.findUnique({where:{id:'mchs-android'},
        select:{lastSeenAt:true,listener:true,push:true,queuedLocal:true,failedSends:true,lastSentAt:true,telemetryAt:true,snapshotOk:true,snapshotAt:true,retryPending:true,nextRetryAt:true,oldestPendingAt:true}}),
      prisma.safetyMchsEvent.findFirst({orderBy:[{receivedAt:'desc'},{id:'desc'}],
        select:{occurredAt:true,receivedAt:true}}),
      prisma.safetyMchsQueueItem.count({where:{status:'OBSERVED'}}),
    ]);
    const configured=process.env.MCHS_OBSERVATION_ANALYZER_ENABLED==='true' && process.env.PREVIEW_MODE!=='true';
    const data=summarizeMchsDelivery({health,lastEvent,pending,
      analyzer:mchsAnalyzerPublicStatus(configured)});
    res.set('Cache-Control','no-store');
    res.json({...data,vmTelemetry:{
      available:Boolean(health?.telemetryAt),
      lastReportedAt:health?.telemetryAt||null,
      queuedLocal:health?.queuedLocal??null,
      failedSends:health?.failedSends??null,
      lastSentAt:health?.lastSentAt||null,
      oldestPendingAt:health?.oldestPendingAt||null,
      oldestPendingAgeMs:health?.oldestPendingAt ? Math.max(0,Date.now()-new Date(health.oldestPendingAt).getTime()) : null,
      retryPending:health?.retryPending??null,
      nextRetryAt:health?.nextRetryAt||null,
      snapshotOk:health?.snapshotOk??null,
      snapshotAt:health?.snapshotAt||null,
      countersAreSelfReported:true,
      telemetryFresh:Boolean(health?.telemetryAt&&Date.now()-new Date(health.telemetryAt).getTime()<180000),
      backlog:assessMchsRetryBacklog(health)
    }});
  } catch(error){next(error);}
});

/** Configuration visibility is not a heartbeat or execution proof. */
router.get('/observation-analyzer/status', canView, async (_req,res,next) => {
  try {
    const configured = process.env.MCHS_OBSERVATION_ANALYZER_ENABLED === 'true' &&
      process.env.PREVIEW_MODE !== 'true';
    const persisted = await prisma.setting.findUnique({
      where:{key:MCHS_ANALYZER_HEALTH_KEY},select:{value:true}
    });
    let saved=null;
    try { saved=JSON.parse(persisted?.value||'null'); } catch {}
    const current=mchsAnalyzerPublicStatus(configured);
    res.set('Cache-Control','no-store');
    res.json({...current,saved,playbackEnabled:false});
  } catch(error){next(error);}
});

/** Read-only durable observation queue; not a command queue. */
/** Read-only event-specific diagnostic trace; never establishes alert authenticity. */
router.get('/message-history/:eventId', canView, async (req, res, next) => {
  try {
    const event = await prisma.safetyMchsEvent.findUnique({
      where: { id: req.params.eventId }, select: { id: true, receivedAt: true }
    });
    if (!event) return res.status(404).json({error:'EVENT_NOT_FOUND'});
    const queueItems = await prisma.safetyMchsQueueItem.findMany({
      where: { eventId: event.id },
      select: {
        id:true,status:true,attempts:true,lastError:true,createdAt:true,updatedAt:true,
        history:{orderBy:[{createdAt:'asc'},{id:'asc'}],take:100,
          select:{id:true,status:true,reason:true,createdAt:true}}
      }
    });
    const row = await prisma.setting.findUnique({where:{key:REVIEW_KEY}});
    let review = null;
    try { const parsed=JSON.parse(row?.value||'{}'); review=parsed?.[event.id]||null; } catch {}
    res.set('Cache-Control','no-store');
    res.json({eventId:event.id,receivedAt:event.receivedAt,
      queues:queueItems,review,officialVerified:false,playbackEnabled:false});
  } catch(error) { next(error); }
});
router.get('/observation-queue', canView, async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(100, Number.parseInt(String(req.query.limit || '30'), 10) || 30));
    const [items, total, pending, analyzed] = await Promise.all([
      prisma.safetyMchsQueueItem.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit,
        select: {
          id: true, status: true, attempts: true, lastError: true,
          createdAt: true, updatedAt: true,
          event: { select: { id: true, sourceEventId: true, eventType: true,
            title: true, occurredAt: true, receivedAt: true, verified: true } },
        },
      }),
      prisma.safetyMchsQueueItem.count(),
      prisma.safetyMchsQueueItem.count({where:{status:'OBSERVED'}}),
      prisma.safetyMchsQueueItem.count({where:{status:'ANALYZED'}}),
    ]);
    res.set('Cache-Control', 'no-store');
    res.json({ total, pending, analyzed, items, dispatchEnabled: false, playbackEnabled: false,
      queuePurpose: 'OBSERVATION_ONLY' });
  } catch (error) { next(error); }
});

/** Chronological assessment, read-only; never serves as an official all-clear. */
/** Immutable ingest history, read-only: never represents alert confirmation. */
router.get('/observation-queue/:queueId/history', canView, async (req,res,next)=>{
 try {
  const rows=await prisma.safetyMchsQueueHistory.findMany({
   where:{queueId:req.params.queueId},orderBy:[{createdAt:'asc'},{id:'asc'}],take:100,
   select:{id:true,status:true,reason:true,createdAt:true}
  });
  res.set('Cache-Control','no-store');
  res.json({items:rows,playbackEnabled:false,officialState:'UNKNOWN'});
 }catch(error){next(error);}
});
/** Admin-triggered diagnostic processing: never dispatches or verifies alerts. */
router.post('/observation-queue/analyze', requireRole('ADMIN'), async (req,res,next)=>{
 try {
  if (Object.keys(req.body||{}).length) return res.status(400).json({error:'NO_ARGUMENTS_ALLOWED'});
  const result=await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(741581423)`;
   const items=await tx.safetyMchsQueueItem.findMany({
    where:{status:'OBSERVED'},orderBy:[{createdAt:'asc'},{id:'asc'}],take:50,
    select:{id:true,event:{select:{title:true,body:true,occurredAt:true}}}
   });
   const counts={};
   for(const item of items){
    const outcome=assessMchsQueueObservation(item.event);
    await tx.safetyMchsQueueItem.update({where:{id:item.id,status:'OBSERVED'},
      data:{status:'ANALYZED'}});
    await tx.safetyMchsQueueHistory.upsert({
      where:{queueId_status_reason:{queueId:item.id,status:'ANALYZED',reason:outcome.reason}},
      create:{queueId:item.id,status:'ANALYZED',reason:outcome.reason},update:{}
    });
    counts[outcome.reason]=(counts[outcome.reason]||0)+1;
   }
   return {processed:items.length,reasons:counts};
  },{timeout:15000});
  res.set('Cache-Control','no-store');
  res.json({...result,status:'ANALYZED',officialVerified:false,playbackEnabled:false,
   note:'Diagnostic observation review only'});
 }catch(error){next(error);}
});

router.get('/observation-order', canView, async (_req, res, next) => {
  try {
    const events = await prisma.safetyMchsEvent.findMany({
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }], take: 200,
      select: { id: true, source: true, sourceEventId: true,
        occurredAt: true, receivedAt: true, title: true, body: true },
    });
    const observations=inspectMchsObservationOrder(events);
    res.set('Cache-Control', 'no-store');
    res.json({ observations, assessedCount:observations.length, officialState:'UNKNOWN',
      authoritative:false, playbackEnabled:false, scope:'LATEST_200_OBSERVATIONS' });
  } catch(error) { next(error); }
});

router.put('/config', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const config = sanitize(req.body);
    if (!config) return res.status(400).json({ error: 'Недопустимые настройки: реальная активация недоступна на этапе 1' });
    await prisma.$transaction(async (tx) => {
      await tx.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: JSON.stringify(config) }, update: { value: JSON.stringify(config) } });
      const history = await tx.setting.findUnique({ where: { key: auditKey } });
      let entries = [];
      try { entries = JSON.parse(history?.value || '[]'); } catch {}
      if (!Array.isArray(entries)) entries = [];
      entries.push({ at: new Date().toISOString(), actorId: req.user.id, action: 'CONFIG_UPDATE', destinations: config.destinations, region: config.region });
      await tx.setting.upsert({ where: { key: auditKey }, create: { key: auditKey, value: JSON.stringify(entries.slice(-100)) }, update: { value: JSON.stringify(entries.slice(-100)) } });
    });
    res.json({ config });
  } catch (error) { next(error); }
});
export default router;
