import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMchsAmplifierDemand} from '../src/lib/mchsAmplifierDemand.js';

const session={eventId:'real-android-172',eventType:'MISSILE_DANGER'};
const status=(overrides={})=>({ok:true,httpStatus:200,data:{
 ok:true,enabled:true,phase:'PLAYING',active:true,session,...overrides
}});
test('fresh authenticated Worker missile PCM allows a bounded amplifier demand',()=>{
 const result=assessMchsAmplifierDemand(status());
 assert.deepEqual(result,{active:true,reason:'MCHS_PCM_ACTIVE',eventId:session.eventId});
});
test('all-clear PCM has exactly the same amplifier permission',()=>{
 assert.equal(assessMchsAmplifierDemand(status({
  session:{...session,eventType:'MISSILE_ALL_CLEAR'}
 })).active,true);
});
test('does not energize on old completed session or ordinary program',()=>{
 for(const phase of ['IDLE','COMPLETE','FAILED','RESUMING']){
  assert.equal(assessMchsAmplifierDemand(status({phase})).active,false,phase);
 }
 assert.equal(assessMchsAmplifierDemand(status({active:false})).active,false);
});
test('do not trust lab audio, arbitrary event types, or unprotected Worker status',()=>{
 assert.equal(assessMchsAmplifierDemand(status({
  session:{...session,eventType:'UAV_DANGER'}
 })).active,false);
 assert.equal(assessMchsAmplifierDemand(status({session:{...session,eventId:''}})).active,false);
 assert.equal(assessMchsAmplifierDemand(status({enabled:false})).active,false);
 assert.equal(assessMchsAmplifierDemand({...status(),httpStatus:403}).active,false);
 assert.equal(assessMchsAmplifierDemand({ok:false,data:status().data}).active,false);
 assert.equal(assessMchsAmplifierDemand(null).active,false);
});
