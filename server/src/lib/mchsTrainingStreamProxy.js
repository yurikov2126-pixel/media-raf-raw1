import http from 'node:http';
/** Authentication stays in safety router; worker accepts only a private shared secret. */
export function trainingStreamRequest(action=null,assetId=null,repeats=1,event=null){
 const port=Number(process.env.RADIO_PLAYOUT_PORT||4105);
 const secret=process.env.RADIO_PLAYOUT_SECRET||'';
 if(!Number.isInteger(port)||port<1||port>65535||secret.length<32)
  return Promise.reject(new Error('WORKER_NOT_CONFIGURED'));
 if(event!==null&&(action!=='START'||event?.trialOnly!==true||
   typeof event?.eventId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(event.eventId)||
   !['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(event?.eventType)||
   (event.eventType==='MISSILE_ALL_CLEAR'&&repeats!==1)))
  return Promise.reject(new Error('INVALID_TRAINING_EVENT_BINDING'));
 if(action==='START'&&(!Number.isInteger(repeats)||repeats<1||repeats>5))
  return Promise.reject(new Error('INVALID_REPEATS'));
 if(action!==null&&!['START','STOP'].includes(action))
  return Promise.reject(new Error('INVALID_ACTION'));
 return new Promise((resolve,reject)=>{
  const payload=action===null?null:JSON.stringify({action,assetId,...(action==='START'?{repeats}:{}),
   ...(event!==null?{eventId:event.eventId,eventType:event.eventType,trialOnly:true}:{})});
  const req=http.request({hostname:'127.0.0.1',port,path:'/mchs-training-stream',
    method:payload?'POST':'GET',timeout:3500,
    headers:{'x-radio-worker-secret':secret,...(payload?{'Content-Type':'application/json',
     'Content-Length':Buffer.byteLength(payload)}:{})}},res=>{
    let raw='',bytes=0;
    res.on('data',chunk=>{bytes+=chunk.length;if(bytes>2048){res.destroy(new Error('RESPONSE_TOO_LARGE'));return;}raw+=chunk;});
    res.on('error',reject);
    res.on('end',()=>{try{resolve({httpStatus:res.statusCode,data:JSON.parse(raw)});}
      catch{reject(new Error('INVALID_WORKER_RESPONSE'));}});
  });
  req.on('timeout',()=>req.destroy(new Error('WORKER_TIMEOUT')));
  req.on('error',reject);
  req.end(payload||undefined);
 });
}
