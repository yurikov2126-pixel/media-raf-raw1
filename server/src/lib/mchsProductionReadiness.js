/**
 * Production MCHS readiness contract, without actuating or dispatching.
 *
 * This is deliberately independent of the legacy isolated-test phrases
 * and GUI checkboxes. It must not be treated as an executable authorization:
 * existing live Android handlers, Worker, Agent and ESP32 remain unchanged.
 */
const EVENTS=new Set(['MISSILE_DANGER','MISSILE_ALL_CLEAR']);
const CHANNELS=['publicRadio','windowsAgent','amplifier'];

export function assessMchsProductionReadiness({
  event,publicRadio,windowsAgent,amplifier,authority
}={}) {
  const checks=[];
  const add=(name,ok,reason)=>checks.push({name,ok:ok===true,reason:ok===true?null:reason});
  add('recognizedEvent',EVENTS.has(event?.eventType),'UNSUPPORTED_EVENT');
  add('eventFresh',Number.isFinite(event?.ageMs)&&event.ageMs>=0&&event.ageMs<=120000,'STALE_EVENT');
  add('uniqueEvent',event?.duplicate===false,'DUPLICATE_OR_UNKNOWN');
  add('boundAudio',typeof event?.assetId==='string'&&event.assetId.length>0&&
    event?.assetVerified===true&&Number.isInteger(event?.repeats)&&event.repeats>=1&&
    event.repeats<=5&&(event.eventType!=='MISSILE_ALL_CLEAR'||event.repeats===1),
    'UNVERIFIED_AUDIO_OR_REPEATS');
  add('centralAuthority',authority?.active===true&&authority?.halted===false,
      'CENTRAL_AUTHORITY_NOT_READY');
  add('workerPublic',publicRadio?.connected===true&&publicRadio?.preemptVerified===true&&
      publicRadio?.playToEndVerified===true&&publicRadio?.resumeVerified===true,
      'PUBLIC_ROUTE_NOT_PROVEN');
  add('agentPlayback',windowsAgent?.connected===true&&windowsAgent?.preemptVerified===true&&
      windowsAgent?.playToEndVerified===true&&windowsAgent?.resumeVerified===true,
      'WINDOWS_ROUTE_NOT_PROVEN');
  add('amplifierPower',amplifier?.esp32HeartbeatFresh===true&&
      amplifier?.relayLeaseRenewalVerified===true&&
      amplifier?.threeSecondWarmupVerified===true&&
      amplifier?.noMidEventDropoutsVerified===true&&
      amplifier?.offAndWatchdogVerified===true&&
      amplifier?.physicalWiringApproved===true,
      'AMPLIFIER_NOT_PROVEN');
  const ready=checks.every(check=>check.ok);
  return {
    ready,
    status:ready?'READY_FOR_CONTROLLED_CUTOVER':'HOLD',
    checks,
    requiredChannels:CHANNELS.slice(),
    // A READY report documents evidence only; it cannot start an alert.
    dispatchAuthorized:false,
    relayOnAuthorized:false,
    publicStreamAuthorized:false
  };
}
