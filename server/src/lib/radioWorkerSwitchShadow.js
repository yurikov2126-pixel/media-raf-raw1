import {randomUUID} from 'node:crypto';

/** Worker-side source switch rehearsal. No encoder writes, no source mutation.
 * All observations must be supplied by trusted Worker/server control plane.
 */
export class RadioWorkerSwitchShadow {
  constructor({clock=()=>Date.now(),ttlMs=2000,maxEvents=100}={}){
    this.clock=clock;this.ttlMs=ttlMs;this.maxEvents=maxEvents;
    this.generation=0;this.pending=null;this.events=[];this.fallbacks=0;
  }
  log(type,reason){
    this.events.push({type,reason,at:this.clock(),generation:this.generation});
    if(this.events.length>this.maxEvents)this.events.shift();
  }
  check(input){
    if(!input||input.scheduleKnown!==true||!Number.isSafeInteger(input.scheduleRevision))
      return 'SCHEDULE_UNKNOWN';
    if(input.scheduledActive!==false)return 'SCHEDULE_ACTIVE';
    if(input.sessionValid!==true||typeof input.leaseId!=='string'||!input.leaseId)
      return 'SESSION_INVALID';
    if(input.pcmHealthy!==true||input.bufferReady!==true)return 'PCM_UNHEALTHY';
    return null;
  }
  prepare(input){
    const failure=this.check(input);
    if(failure){this.cancel(failure);return {ok:false,reason:failure,changeApplied:false};}
    this.generation++;
    this.pending={token:randomUUID(),revision:input.scheduleRevision,leaseId:input.leaseId,
      generation:this.generation,expires:this.clock()+this.ttlMs};
    this.log('PREPARE','SHADOW_READY');
    return {ok:true,proposalId:this.pending.token,expiresAt:this.pending.expires,
      changeApplied:false};
  }
  verify({proposalId,input}={}){
    const p=this.pending;
    if(!p||proposalId!==p.token)return {ok:false,reason:'NO_PENDING_PROPOSAL',changeApplied:false};
    if(this.clock()>p.expires){this.cancel('EXPIRED');return {ok:false,reason:'EXPIRED',changeApplied:false};}
    const failure=this.check(input);
    if(failure){this.cancel(failure);return {ok:false,reason:failure,changeApplied:false};}
    if(input.scheduleRevision!==p.revision||input.leaseId!==p.leaseId){
      this.cancel('FENCE_CHANGED');return {ok:false,reason:'FENCE_CHANGED',changeApplied:false};
    }
    this.log('VERIFY','SHADOW_VERIFIED');
    return {ok:true,verified:true,connectedToEncoder:false,changeApplied:false};
  }
  cancel(reason='CANCELLED'){
    this.pending=null;this.generation++;this.log('CANCEL',reason);
    return {ok:true,changeApplied:false};
  }
  fallback(reason='SOURCE_UNHEALTHY'){
    this.cancel(reason);this.fallbacks++;this.log('FALLBACK_ADVISORY','AUTO_DJ');
    return {ok:true,recommendedSource:'AUTO_DJ',changeApplied:false};
  }
  snapshot(){return {mode:'SHADOW_ONLY',pending:!!this.pending,
    generation:this.generation,fallbacks:this.fallbacks,
    events:this.events.slice(),connectedToEncoder:false,changeApplied:false};}
}
