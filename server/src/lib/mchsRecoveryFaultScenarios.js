import {normalizeMchsDispatchProtocol,stageMchsDispatchCommand,recordMchsDispatchDryRunAck,haltMchsDispatchProtocol} from './mchsDispatchProtocol.js';
import {recoverExecutionJournal} from './mchsExecutionJournal.js';
import {assessMchsTransportChain} from './mchsTransportChainDiagnostics.js';

/** Deterministic, in-memory fault exercise. Never issues transport or audio commands. */
export function simulateMchsRecoveryFault({protocol,executionJournal,telemetry,steps=[],nowMs=Date.now()}={}){
 let commands=normalizeMchsDispatchProtocol(protocol);
 let journal=recoverExecutionJournal(executionJournal);
 let chain=assessMchsTransportChain({...telemetry,nowMs});
 const history=[];
 for(const step of steps.slice(0,100)){
  const at=Number.isFinite(step?.atMs)?step.atMs:nowMs;
  let result='IGNORED';
  if(step?.type==='STAGE'){
   const outcome=stageMchsDispatchCommand(commands,step.command||{},at);
   commands=outcome.state;result=outcome.accepted?'STAGED':outcome.reason;
  }else if(step?.type==='DRY_RUN_ACK'){
   const outcome=recordMchsDispatchDryRunAck(commands,step.command||{},at);
   commands=outcome.state;result=outcome.accepted?'ACKED_DRY_RUN':outcome.reason;
  }else if(step?.type==='HALT'){
   commands=haltMchsDispatchProtocol(commands,at);result='HALTED';
  }else if(step?.type==='API_RESTART'||step?.type==='WORKER_RESTART'){
   commands=normalizeMchsDispatchProtocol(JSON.parse(JSON.stringify(commands)));
   journal=recoverExecutionJournal(journal);
   chain=assessMchsTransportChain({nowMs:at});
   result='RECOVERY_HOLD';
  }else if(step?.type==='LINK_LOST'){
   chain=assessMchsTransportChain({nowMs:at});result='NOT_READY';
  }else if(step?.type==='LINK_RESTORED'){
   chain=assessMchsTransportChain({...telemetry,nowMs:at});
   result='TELEMETRY_ONLY';
  }
  history.push({type:step?.type||'UNKNOWN',result:result,
   dispatchAuthorized:false,automaticPlaybackEnabled:false});
 }
 return {protocol:commands,journal,chain,history,
  dispatchAuthorized:false,automaticPlaybackEnabled:false,paOutputVerified:false};
}
