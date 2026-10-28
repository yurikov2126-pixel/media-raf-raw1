import {createEmergencyDryRun} from '../lib/radioEmergencyDryRun.js';

const sources=['AUTO_DJ','SCHEDULE','LIVE','MANUAL_PLAYLIST','AUTO_PLAYLIST'];
const controls={trustedControlPlane:true,operatorAuthorized:true,audioAssetReady:true,outputChainVerified:true,emergencyAudioStopped:true,programResumed:true};
const sequence=['PREPARE','ACTIVATE','STOP','RECOVER','RESET'];
const recovery={AUTO_DJ:'Начать следующий трек по актуальной позиции AutoDJ',SCHEDULE:'Пересчитать текущий слот эфирной сетки по времени',LIVE:'Проверить подключение студии перед возвратом',MANUAL_PLAYLIST:'Возобновить по действующим правилам плейлиста',AUTO_PLAYLIST:'Пересчитать текущий автоматический плейлист'};
export function runEmergencySimulationScenario(source) {
 if(!sources.includes(source))return {ok:false,error:'INVALID_SOURCE'};
 const simulator=createEmergencyDryRun({now:()=>Date.now()});
 const requestId='simulation-'+source;
 const results=sequence.map(type=>simulator.run({type,requestId,...(type==='PREPARE'?{targets:['radio','speakers']}: {})},{...controls,source}));
 return {ok:results.every(x=>x.accepted)&&simulator.snapshot().state.phase==='IDLE',
   source,steps:simulator.snapshot().history,finalState:simulator.snapshot().state.phase,
   recoveryPlan:recovery[source],realSourceVerified:false,simulationOnly:true,playbackChanged:false};
}
export function runEmergencySimulationSuite(){
 return {scenarios:sources.map(runEmergencySimulationScenario),simulationOnly:true,playbackChanged:false};
}
