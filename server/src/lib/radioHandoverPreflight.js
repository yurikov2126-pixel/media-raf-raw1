import { randomUUID } from 'node:crypto';

/**
 * Audio Engine 4.6: isolated handover preflight state machine.
 * Never invokes a playout/encoder action. All transitions are advisory.
 * A proposal is invalidated whenever the current schedule version, presenter
 * identity/lease or PCM health changes. The actual on-air commit is absent.
 */
export class RadioHandoverPreflight {
  constructor({ttlMs=3000,maxJournal=100,now=()=>Date.now(),idFactory=randomUUID}={}){
    if(!Number.isSafeInteger(ttlMs)||ttlMs<100||!Number.isSafeInteger(maxJournal)||maxJournal<1)
      throw new TypeError('Invalid preflight settings');
    this.ttlMs=ttlMs;this.maxJournal=maxJournal;this.now=now;this.idFactory=idFactory;
    this.epoch=0;this.proposal=null;this.events=[];
  }
  record(action,reason,extra={}){
    const event={action,reason,at:this.now(),epoch:this.epoch,...extra};
    this.events.push(event);
    if(this.events.length>this.maxJournal)this.events.shift();
    return event;
  }
  // Snapshot must be sourced server-side (never taken from browser status).
  check(snapshot){
    if(!snapshot||snapshot.scheduleKnown!==true)return 'SCHEDULE_UNKNOWN';
    if(snapshot.scheduledActive!==false)return 'SCHEDULE_PRIORITY';
    if(snapshot.presenterAuthorized!==true||snapshot.presenterConnected!==true)return 'PRESENTER_UNAVAILABLE';
    if(snapshot.gatewayRunning!==true||snapshot.pcmReady!==true)return 'PCM_NOT_READY';
    if(typeof snapshot.presenterId!=='string'||!snapshot.presenterId)return 'PRESENTER_ID_MISSING';
    if(typeof snapshot.leaseId!=='string'||!snapshot.leaseId)return 'LEASE_MISSING';
    if(!Number.isSafeInteger(snapshot.scheduleRevision)||snapshot.scheduleRevision<0)return 'SCHEDULE_REVISION_UNKNOWN';
    return null;
  }
  prepare(snapshot){
    const reason=this.check(snapshot);
    if(reason){this.invalidate(reason);return {ok:false,reason,changeApplied:false};}
    this.epoch++;
    const token=this.idFactory();
    this.proposal={token,epoch:this.epoch,presenterId:snapshot.presenterId,leaseId:snapshot.leaseId,
      scheduleRevision:snapshot.scheduleRevision,expiresAt:this.now()+this.ttlMs};
    this.record('PREPARE','READY',{presenterId:snapshot.presenterId});
    return {ok:true,proposalId:token,expiresAt:this.proposal.expiresAt,changeApplied:false};
  }
  validate(proposalId,snapshot){
    const proposal=this.proposal;
    if(!proposal||typeof proposalId!=='string'||proposal.token!==proposalId)
      return {ok:false,reason:'PROPOSAL_NOT_FOUND',changeApplied:false};
    if(this.now()>proposal.expiresAt){this.invalidate('PROPOSAL_EXPIRED');return {ok:false,reason:'PROPOSAL_EXPIRED',changeApplied:false};}
    const reason=this.check(snapshot);
    if(reason){this.invalidate(reason);return {ok:false,reason,changeApplied:false};}
    if(snapshot.presenterId!==proposal.presenterId||snapshot.leaseId!==proposal.leaseId||
      snapshot.scheduleRevision!==proposal.scheduleRevision){
      this.invalidate('FENCE_MISMATCH');return {ok:false,reason:'FENCE_MISMATCH',changeApplied:false};
    }
    this.record('VALIDATE','READY');
    return {ok:true,reason:'DRY_RUN_VERIFIED',changeApplied:false};
  }
  invalidate(reason='CANCELLED'){
    this.epoch++;
    this.proposal=null;
    this.record('INVALIDATE',reason);
    return {ok:true,changeApplied:false};
  }
  failover(reason='PRESENTER_LOST'){
    this.invalidate(reason);
    this.record('FALLBACK_RECOMMENDED','AUTO_DJ');
    return {recommendedSource:'AUTO_DJ',reason,changeApplied:false};
  }
  snapshot(){
    return {pending:!!this.proposal,epoch:this.epoch,expiresAt:this.proposal?.expiresAt??null,
      journal:this.events.slice(),changeApplied:false,connectedToEncoder:false};
  }
}
