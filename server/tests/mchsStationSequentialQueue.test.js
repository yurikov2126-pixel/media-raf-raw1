import test from 'node:test';
import assert from 'node:assert/strict';
import {selectNextMchsStationIntent,settleMchsStationAttempt} from '../src/lib/mchsStationSequentialQueue.js';
const occurredAt='2026-11-05T20:00:00.000Z',nowMs=Date.parse(occurredAt)+25000;
const intent=(eventId,type='MISSILE_DANGER',timestamp=occurredAt)=>({
 eventId,sourceEventId:eventId,assetId:'alarm_a',eventType:type,
 repetitions:type==='MISSILE_ALL_CLEAR'?1:3,occurredAt:timestamp,
 status:'STAGED',createdAt:timestamp
});
const status=(phase='COMPLETE',active=false)=>({ok:true,data:{ok:true,
 phase,active,terminalJournal:{healthy:true}}});
test('danger is dispatched first; later all-clear waits while Worker plays',()=>{
 const rows={items:[intent('danger'),intent('clear','MISSILE_ALL_CLEAR',
  new Date(Date.parse(occurredAt)+10000).toISOString())]};
 const busy=selectNextMchsStationIntent(rows,{nowMs,workerStatus:status('PLAYING',true)});
 assert.equal(busy.candidate,null);
 assert.equal(busy.blocked,'WORKER_BUSY');
 const ready=selectNextMchsStationIntent(rows,{nowMs,workerStatus:status()});
 assert.equal(ready.candidate.eventId,'danger');
 const next=selectNextMchsStationIntent({items:[
  {...rows.items[0],status:'START_ACCEPTED'},rows.items[1]
 ]},{nowMs,workerStatus:status()});
 assert.equal(next.candidate.eventId,'clear');
 assert.equal(next.candidate.repetitions,1);
});
test('Worker busy rejection returns to queue rather than disappearing',()=>{
 const queued=settleMchsStationAttempt({...intent('clear','MISSILE_ALL_CLEAR'),
  status:'DISPATCHING'},{
  ok:false,httpStatus:409,data:{reason:'STATION_SOURCE_BUSY'}});
 assert.equal(queued.status,'QUEUED');
 const after=selectNextMchsStationIntent({items:[queued]},
  {nowMs,workerStatus:status('COMPLETE')});
 assert.equal(after.candidate.eventId,'clear');
});
test('unknown transport result remains failed, not a successful broadcast',()=>{
 const row={...intent('danger'),status:'DISPATCHING'};
 const result=settleMchsStationAttempt(row,{ok:false,reason:'WORKER_TIMEOUT'});
 assert.equal(result.status,'START_REJECTED');
 assert.equal(result.lastError,'WORKER_TIMEOUT');
});
test('expired queued commands are never re-issued with a fake recent timestamp',()=>{
 const row={items:[intent('old'),intent('fresh','MISSILE_ALL_CLEAR',
  new Date(Date.parse(occurredAt)+170000).toISOString())]};
 const out=selectNextMchsStationIntent(row,{nowMs:Date.parse(occurredAt)+185000,
  workerStatus:status()});
 assert.equal(out.items[0].status,'EXPIRED');
 assert.equal(out.candidate.eventId,'fresh');
 assert.equal(out.items[0].lastError,'EVENT_NOT_FRESH');
});
test('unavailable or unhealthy Worker cannot admit even one queued event',()=>{
 const rows={items:[intent('danger')]};
 assert.equal(selectNextMchsStationIntent(rows,{nowMs,
  workerStatus:{ok:false}}).candidate,null);
 assert.equal(selectNextMchsStationIntent(rows,{nowMs,
  workerStatus:{ok:true,data:{ok:true,phase:'COMPLETE',
   terminalJournal:{healthy:false}}}}).candidate,null);
});
test('already claimed events are not selected again after API restart',()=>{
 const rows={items:[{...intent('danger'),status:'DISPATCHING'}]};
 assert.equal(selectNextMchsStationIntent(rows,{nowMs,workerStatus:status()}).candidate,null);
});
