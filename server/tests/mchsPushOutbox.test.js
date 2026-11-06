import test from 'node:test';
import assert from 'node:assert/strict';
import {processMchsPushOutbox} from '../src/lib/mchsPushOutbox.js';

const nowMs=Date.parse('2026-11-06T20:00:00.000Z');
function fakeDb(items){
 const rows=items.map(x=>({...x}));
 const updates=[];
 return {
  rows,updates,
  safetyMchsPushDelivery:{
   async findMany(){return rows.filter(x=>x.status==='PENDING').map(x=>({...x}));},
   async updateMany({where,data}){
    const row=rows.find(x=>x.eventId===where.eventId&&x.status===where.status);
    if(!row)return {count:0};
    Object.assign(row,data);
    updates.push({eventId:row.eventId,status:row.status});
    return {count:1};
   }
  }
 };
}
const event=(id,occurredAt='2026-11-06T19:59:57Z',type='MISSILE_DANGER')=>({
 eventId:id,eventType:type,body:'Тульская область',occurredAt,status:'PENDING',
 createdAt:'2026-11-06T19:59:58Z'
});
test('exactly one Web PUSH and one Android FCM batch for a fresh event',async()=>{
 const db=fakeDb([event('event-1')]);
 const web=[],mobile=[];
 const sender=async payload=>{web.push(payload);return {sent:4,failed:0};};
 const native=async payload=>{mobile.push(payload);return {sent:3,failed:0};};
 const result=await processMchsPushOutbox({db,webSender:sender,mobileSender:native,nowMs});
 assert.equal(result.handled,1);
 assert.equal(web.length,1);assert.equal(mobile.length,1);
 assert.equal(web[0].title,'Ракетная опасность');
 assert.equal(web[0].tag,mobile[0].tag);
 assert.equal(db.rows[0].status,'SENT');
 assert.equal(db.rows[0].webSent,4);
 assert.equal(db.rows[0].mobileSent,3);
 await processMchsPushOutbox({db,webSender:sender,mobileSender:native,nowMs});
 assert.equal(web.length,1);
});
test('expired queued alerts are not replayed as stale PUSH notifications',async()=>{
 const db=fakeDb([event('old','2026-11-06T19:50:00Z')]);
 let dispatched=0;
 await processMchsPushOutbox({db,nowMs,
  webSender:async()=>{dispatched++;return {sent:1};},
  mobileSender:async()=>{dispatched++;return {sent:1};}});
 assert.equal(db.rows[0].status,'EXPIRED');
 assert.equal(dispatched,0);
});
test('a crash-uncertain claimed event is not resent on restart',async()=>{
 const db=fakeDb([{...event('already-sending'),status:'SENDING'}]);
 let count=0;
 await processMchsPushOutbox({db,nowMs,
  webSender:async()=>{count++;return {sent:1};},
  mobileSender:async()=>{count++;return {sent:1};}});
 assert.equal(count,0);
});
test('Web Push provider failure does not prevent Android FCM delivery',async()=>{
 const db=fakeDb([event('uav',undefined,'UAV_ALL_CLEAR')]);
 await processMchsPushOutbox({db,nowMs,
  webSender:async()=>{throw Error('temporary browser push transport failure');},
  mobileSender:async()=>({sent:5,failed:0})});
 assert.equal(db.rows[0].status,'SENT');
 assert.equal(db.rows[0].webSent,0);
 assert.equal(db.rows[0].mobileSent,5);
 assert.equal(db.rows[0].error,'CHANNEL_SEND_ERROR');
});
test('no registered receivers is not misreported as successful delivery',async()=>{
 const db=fakeDb([event('no-subs')]);
 await processMchsPushOutbox({db,nowMs,
  webSender:async()=>({sent:0,failed:0}),
  mobileSender:async()=>({sent:0,failed:0,skipped:true})});
 assert.equal(db.rows[0].status,'NO_DELIVERY_CONFIRMED');
 assert.equal(db.rows[0].webSent,0);
});
