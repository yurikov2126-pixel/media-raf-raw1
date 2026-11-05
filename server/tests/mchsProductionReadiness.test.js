import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMchsProductionReadiness} from '../src/lib/mchsProductionReadiness.js';

const complete=()=>({
  event:{eventType:'MISSILE_DANGER',ageMs:200,duplicate:false,
         assetId:'alarm-wav',assetVerified:true,repeats:2},
  authority:{active:true,halted:false},
  publicRadio:{connected:true,preemptVerified:true,playToEndVerified:true,resumeVerified:true},
  windowsAgent:{connected:true,preemptVerified:true,playToEndVerified:true,resumeVerified:true},
  amplifier:{esp32HeartbeatFresh:true,relayLeaseRenewalVerified:true,
             threeSecondWarmupVerified:true,noMidEventDropoutsVerified:true,
             offAndWatchdogVerified:true,physicalWiringApproved:true}
});

test('complete read-only evidence never becomes output authorization',()=>{
  const result=assessMchsProductionReadiness(complete());
  assert.equal(result.ready,true);
  assert.equal(result.dispatchAuthorized,false);
  assert.equal(result.relayOnAuthorized,false);
  assert.equal(result.publicStreamAuthorized,false);
});

test('production is held when physical relay drops out during message',()=>{
  const input=complete();
  input.amplifier.noMidEventDropoutsVerified=false;
  const result=assessMchsProductionReadiness(input);
  assert.equal(result.ready,false);
  assert.equal(result.status,'HOLD');
  assert.equal(result.checks.find(x=>x.name==='amplifierPower').reason,'AMPLIFIER_NOT_PROVEN');
});

test('production is held when worker has not actually interrupted public radio',()=>{
  const input=complete();
  input.publicRadio.preemptVerified=false;
  assert.equal(assessMchsProductionReadiness(input).ready,false);
});

test('old isolated test consents never count as production evidence',()=>{
  const input={event:{eventType:'MISSILE_DANGER',ageMs:1,
                      assetId:'x',assetVerified:true,repeats:1,duplicate:false},
               isolated:true,operatorConfirmation:'ISOLATED RELAY',relayPilot:true};
  assert.equal(assessMchsProductionReadiness(input).ready,false);
});

test('all-clear must play once and an old event is refused',()=>{
  const input=complete();
  input.event.eventType='MISSILE_ALL_CLEAR';
  input.event.repeats=2;
  assert.equal(assessMchsProductionReadiness(input).ready,false);
  input.event.repeats=1;
  input.event.ageMs=120001;
  assert.equal(assessMchsProductionReadiness(input).ready,false);
});

test('unknown, duplicated, halted and unverified events cannot pass',()=>{
  for(const alteration of [
    item=>item.event.duplicate=true,
    item=>item.event.eventType='FLOOD',
    item=>item.event.assetVerified=false,
    item=>item.authority.halted=true,
    item=>item.windowsAgent.connected=false,
    item=>item.amplifier.offAndWatchdogVerified=false
  ]){
    const input=complete();
    alteration(input);
    assert.equal(assessMchsProductionReadiness(input).ready,false);
  }
});
