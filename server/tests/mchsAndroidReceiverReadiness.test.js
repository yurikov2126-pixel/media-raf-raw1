import test from 'node:test';
import assert from 'node:assert/strict';
import {assessAndroidReceiverReadiness} from '../src/lib/mchsAndroidReceiverReadiness.js';

const now=Date.parse('2026-11-09T00:30:00Z');
function rows(listener='CONNECTED',snapshotOk=true){
 return [0,60,120,180].map(s=>({
  receivedAt:new Date(now-s*1000).toISOString(),listener,snapshotOk
 }));
}
const check=samples=>assessAndroidReceiverReadiness({
 samples,lastSeenAt:new Date(now).toISOString(),nowMs:now
});

test('recent heartbeat alone never proves push delivery',()=>{
 const r=check(rows());
 assert.equal(r.state,'RECEIVER_OBSERVED');
 assert.equal(r.code,null);
 assert.match(r.detail,/не подтверждено/);
});
test('three disconnected listener observations trigger independent warning',()=>{
 const r=check(rows('DISCONNECTED',true));
 assert.equal(r.code,'ANDROID_LISTENER_DISCONNECTED');
});
test('three failed SQLite snapshots trigger independent warning',()=>{
 const r=check(rows('CONNECTED',false));
 assert.equal(r.code,'ANDROID_SNAPSHOT_UNAVAILABLE');
});
test('transient listener restart does not create warning',()=>{
 const data=rows('DISCONNECTED');
 data[0].listener='CONNECTED';
 assert.equal(check(data).code,null);
});
test('stale heartbeat cannot be interpreted as app readiness',()=>{
 const r=assessAndroidReceiverReadiness({
  samples:rows(),lastSeenAt:new Date(now-6*60000).toISOString(),nowMs:now
 });
 assert.equal(r.state,'HEARTBEAT_STALE');
 assert.equal(r.code,null);
});
test('insufficient fresh snapshots are inconclusive, not success',()=>{
 assert.equal(check(rows().slice(0,1)).state,'INSUFFICIENT_SAMPLES');
});
