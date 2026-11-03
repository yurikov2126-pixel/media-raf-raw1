/** Select an Agent command without converting a queued test into a public
 * broadcast. START needs three independently configured trial gates.
 * No request argument can set these gates.
 */
export function selectMchsAgentCommand({delivered,ledger,dispatch,isolatedTrialEnabled=false,
 deviceTrialBound=false}={}){
 const pending=delivered?.command;
 const deny=reason=>({command:null,halted:true,executionEnabled:false,
  automaticPlaybackEnabled:false,reason});
 if(pending?.action==='STOP')return {...deny('EMERGENCY_STOP'),command:pending};
 if(pending?.action!=='START')return deny('NO_START_QUEUED');
 if(!isolatedTrialEnabled||!deviceTrialBound)return deny('ISOLATED_TRIAL_DISABLED');
 if(ledger?.halted!==false||dispatch?.halted!==false)return deny('HALT_ACTIVE');
 if(pending.trialOnly!==true||pending.officialSourceVerified!==true)
  return deny('TRIAL_EVIDENCE_MISSING');
 if(!Number.isSafeInteger(pending.sequence)||pending.sequence<1||
  !/^[a-f0-9]{64}$/.test(pending.sha256||'')||
  !/^[A-Za-z0-9_-]{1,128}$/.test(pending.assetId||''))
  return deny('INVALID_START_ASSET');
 return {command:pending,halted:false,executionEnabled:true,
  automaticPlaybackEnabled:false,reason:'ISOLATED_AGENT_TRIAL_ONLY'};
}
