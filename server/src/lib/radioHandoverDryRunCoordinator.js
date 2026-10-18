import {RadioHandoverPreflight} from './radioHandoverPreflight.js';

/**
 * Single-process read-only coordinator for control-plane dry runs.
 * Only server-authoritative observations are accepted by a caller.
 * A new prepare cancels the old token (latest intent wins); no encoder actions.
 */
export class RadioHandoverDryRunCoordinator {
  constructor({engine=new RadioHandoverPreflight()}={}){
    this.engine=engine;this.activeOwner=null;
  }
  prepare({owner,snapshot}={}){
    if(typeof owner!=='string'||!owner)return {ok:false,reason:'OWNER_REQUIRED',changeApplied:false};
    if(this.activeOwner&&this.activeOwner!==owner)
      return {ok:false,reason:'ANOTHER_OPERATOR_PREPARING',changeApplied:false};
    const result=this.engine.prepare(snapshot);
    if(result.ok)this.activeOwner=owner;
    return result;
  }
  verify({owner,proposalId,snapshot}={}){
    if(this.activeOwner!==owner||!this.activeOwner)
      return {ok:false,reason:'OWNER_MISMATCH',changeApplied:false};
    const result=this.engine.validate(proposalId,snapshot);
    if(!result.ok)this.activeOwner=null;
    return result;
  }
  release({owner,reason='OPERATOR_CANCELLED'}={}){
    if(this.activeOwner&&owner!==this.activeOwner)
      return {ok:false,reason:'OWNER_MISMATCH',changeApplied:false};
    this.activeOwner=null;
    return this.engine.invalidate(reason);
  }
  onPresenterLost(reason='PRESENTER_LOST'){
    this.activeOwner=null;
    return this.engine.failover(reason);
  }
  snapshot(){return {ownerPresent:!!this.activeOwner,...this.engine.snapshot()};}
}
