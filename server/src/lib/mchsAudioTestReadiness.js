import {planRadioEmergencyResume} from './radioEmergencyResumePlan.js';

/**
 * Read-only preflight for introducing REAL audio tests safely.
 * Does not authorize playback. Missing evidence always blocks real-audio readiness.
 */
export function assessEmergencyAudioTestReadiness({
  workerReachable=false,workerSource='UNKNOWN',workerError=null,
  nowMs=Date.now(),slots=[],liveConnected=false,liveAuthorized=false,playlistActive=false,
  testAudioValidated=false,isolatedOutputConfirmed=false,stopControlTested=false,
  rollbackTested=false,operatorPresent=false
}={}){
  const resume=workerReachable?planRadioEmergencyResume({
    source:workerSource,nowMs,slots,liveConnected,liveAuthorized,playlistActive
  }):{ready:false,reason:'WORKER_UNAVAILABLE',action:'RECHECK_STATION_AUTHORITY',simulationOnly:true};
  const checks=[
    {id:'WORKER',passed:workerReachable&&!workerError,description:'Radio Worker доступен без текущей ошибки'},
    {id:'RESUME_PLAN',passed:resume.ready===true,description:'Есть допустимый диагностический план восстановления'},
    {id:'AUDIO_ASSET',passed:testAudioValidated===true,description:'Тестовый звуковой файл предварительно проверен'},
    {id:'ISOLATION',passed:isolatedOutputConfirmed===true,description:'Тестовый выход физически изолирован от громкоговорителей колледжа'},
    {id:'STOP',passed:stopControlTested===true,description:'Проверена отдельная остановка тестового звука'},
    {id:'ROLLBACK',passed:rollbackTested===true,description:'Проверено восстановление штатного эфира'},
    {id:'SUPERVISION',passed:operatorPresent===true,description:'При тестировании присутствует ответственный'}
  ];
  return {checks,unmet:checks.filter(x=>!x.passed).map(x=>x.id),readyForIsolatedAudioTest:checks.every(x=>x.passed),
    resume,playbackChanged:false,realAudioTestStarted:false,automaticMchsEnabled:false};
}
