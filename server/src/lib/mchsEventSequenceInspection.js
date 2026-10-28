import { classifyMchsObservation } from './mchsClassification.js';
import { planMchsAudioTransition } from './mchsAudioTransitionPlan.js';
import { planRadioResumeAfterExternalAudio } from './mchsRadioResumePlan.js';

/**
 * Deterministic observation-only event sequence evaluation.
 * Never plays audio, changes current source, or authenticates government alerts.
 * Deduplication is scoped to the event IDs provided by the caller.
 */
export function inspectMchsEventSequence({
  events=[], rules={}, assets=[], previous=null, current=null,
  scheduleKnown=false, scheduleActive=false, liveActive=false,
  nowMs=Date.now(), officialVerified=false,
  physicalOutputIsolated=false, publicStreamIsolated=false,
}={}) {
  const seen=new Set();
  const byAsset=new Map(assets.map(a=>[a.id,a]));
  const results=events.map(event=>{
    const id=event?.sourceEventId;
    const eventType=classifyMchsObservation(event?.title,event?.body);
    const rule=rules[eventType];
    const timestamp=event?.occurredAt ? new Date(event.occurredAt).getTime() : NaN;
    const ageMs=Number.isFinite(timestamp)?nowMs-timestamp:null;
    const duplicate=typeof id!=='string' || !id.trim() || seen.has(id);
    if(typeof id==='string' && id.trim()) seen.add(id);
    const transition=planMchsAudioTransition({
      eventType,audioAsset:byAsset.get(rule?.audioAssetId),source:current?.mode,
      sourceId:current?.id,ageMs,officialVerified,physicalOutputIsolated,publicStreamIsolated,
    });
    const reasons=[
      ...(duplicate?['DUPLICATE_OR_MISSING_EVENT_ID']:[]),
      ...(rule?.mode!=='REVIEW'?['RULE_DISABLED']:[]),
      ...transition.reasons,
    ];
    return {
      sourceEventId:id||null,eventType,status:reasons.length?'BLOCKED':'DESIGN_REVIEW_REQUIRED',
      reasons:[...new Set(reasons)],
      audioAssetId:rule?.audioAssetId||null,canDispatch:false,
    };
  });
  const resume=planRadioResumeAfterExternalAudio({
    previous,current,scheduleKnown,scheduleActive,liveActive,
  });
  return {results,resume,canDispatch:false,executable:false,output:'NONE'};
}
