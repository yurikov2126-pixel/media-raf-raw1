import {prisma} from './prisma.js';
import {sendPushToAll} from './push.js';
import {sendMobilePushToAll} from './mobilePush.js';
import {buildMchsPushPayload,MCHS_PUSH_MAX_AGE_MS} from './mchsPushEligibility.js';

let inFlight=false;
let scheduled=false;

/** Queue rows are claimed before sending; never replay an uncertain delivery
 * automatically after a process crash. Multiple API processes can race safely.
 */
export async function processMchsPushOutbox({
 db=prisma,
 webSender=sendPushToAll,
 mobileSender=sendMobilePushToAll,
 nowMs=Date.now()
}={}){
 const pending=await db.safetyMchsPushDelivery.findMany({
  where:{status:'PENDING'},orderBy:{createdAt:'asc'},take:20
 });
 let handled=0;
 for(const row of pending){
  const tooOld=nowMs-Date.parse(row.occurredAt)>MCHS_PUSH_MAX_AGE_MS;
  const claimed=await db.safetyMchsPushDelivery.updateMany({
   where:{eventId:row.eventId,status:'PENDING'},
   data:{status:tooOld?'EXPIRED':'SENDING',
    claimedAt:new Date(nowMs),
    ...(tooOld?{completedAt:new Date(nowMs),error:'STALE_EVENT'}:{})}
  });
  if(claimed.count!==1)continue;
  handled++;
  if(tooOld)continue;
  const payload=buildMchsPushPayload({type:row.eventType,eventId:row.eventId,body:row.body});
  // Web Push and Android FCM use the existing delivery infrastructure.
  // Avoid any retry if one channel succeeded but the other channel failed.
  const [web,mobile]=await Promise.allSettled([
   webSender(payload,{ttl:120}),
   mobileSender(payload)
  ]);
  const webSent=web.status==='fulfilled'?web.value.sent||0:0;
  const mobileSent=mobile.status==='fulfilled'?mobile.value.sent||0:0;
  const failed=(web.status==='fulfilled'?web.value.failed||0:1)+
   (mobile.status==='fulfilled'?mobile.value.failed||0:1);
  const error=web.status==='rejected'||mobile.status==='rejected'?'CHANNEL_SEND_ERROR':null;
  await db.safetyMchsPushDelivery.updateMany({
   where:{eventId:row.eventId,status:'SENDING'},
   data:{status:webSent+mobileSent>0?'SENT':error?'FAILED':'NO_SUBSCRIBERS',
    webSent,mobileSent,failed,completedAt:new Date(),error}
  });
  console.info('MCHS_PUSH_DELIVERY',JSON.stringify({
   eventId:row.eventId,eventType:row.eventType,webSent,mobileSent,failed,
   error
  }));
 }
 return {handled};
}

export async function tickMchsPushOutbox(){
 if(inFlight)return;
 inFlight=true;
 try{await processMchsPushOutbox();}
 catch(e){console.error('MCHS_PUSH_OUTBOX_ERROR',e?.message||'UNKNOWN');}
 finally{inFlight=false;}
}

export function wakeMchsPushOutbox(){
 if(scheduled)return;
 scheduled=true;
 Promise.resolve().then(()=>{
  scheduled=false;
  void tickMchsPushOutbox();
 });
}

export function startMchsPushOutbox(){
 void tickMchsPushOutbox();
 const timer=setInterval(()=>{void tickMchsPushOutbox();},5000);
 timer.unref?.();
 return ()=>clearInterval(timer);
}
