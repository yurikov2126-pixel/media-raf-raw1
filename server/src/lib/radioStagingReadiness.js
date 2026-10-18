/** One-screen rehearsal gate; a fail-closed checklist, NEVER on-air authorization. */
export function evaluateRadioStagingReadiness({worker={},studio={},hardwareDisconnected=false}={}){
 const steps=[
  {id:'worker',ok:worker.reachable===true,detail:'Worker доступен только через защищённый канал'},
  {id:'gateway',ok:studio.gatewayRunning===true,detail:'Opus → FFmpeg → PCM работает'},
  {id:'session',ok:studio.presenterConnected===true,detail:'Ведущий держит текущую сессию'},
  {id:'pcm',ok:worker.pcmFresh===true,detail:'Поступают свежие PCM-кадры'},
  {id:'isolation',ok:worker.connectedToEncoder===false,detail:'Тест не подключён к станционному MP3'},
  {id:'headphones',ok:hardwareDisconnected===true,detail:'Физически отключена PA/усилитель, используются наушники'},
 ];
 return {readyForIsolatedTest:steps.every(x=>x.ok),readyForPublicBroadcast:false,
  steps,failed:steps.filter(x=>!x.ok).map(x=>x.id)};
}
