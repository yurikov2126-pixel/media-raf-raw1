import http from 'node:http';
/** Private, authenticated transport to the Worker receipt-only endpoint. Never plays audio. */
export function sendMchsDryRunReceipt({commandId,eventType,leaseToken}){
 const port=Number(process.env.RADIO_PLAYOUT_PORT||4105);
 const secret=process.env.RADIO_PLAYOUT_SECRET||'';
 if(!Number.isInteger(port)||port<1||port>65535||secret.length<32)
  return Promise.reject(new Error('WORKER_NOT_CONFIGURED'));
 const body=JSON.stringify({commandId,eventType,leaseToken});
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port,path:'/mchs-command-receipt',
   method:'POST',timeout:3500,headers:{'x-radio-worker-secret':secret,
    'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},res=>{
   let raw='',bytes=0;
   res.on('data',chunk=>{bytes+=chunk.length;if(bytes>2048){res.destroy(new Error('RESPONSE_TOO_LARGE'));return;}raw+=chunk;});
   res.on('error',reject);
   res.on('end',()=>{try{
    const data=JSON.parse(raw);
    if(res.statusCode!==200||data.ok!==true||data.executionEnabled!==false||
      data.receipt?.commandId!==commandId||data.receipt?.eventType!==eventType||
      data.receipt?.status!=='RECEIVED_DRY_RUN'||data.receipt?.playbackStarted!==false)
      return reject(new Error('INVALID_WORKER_RECEIPT'));
    resolve({ok:true,duplicate:!!data.duplicate,receipt:data.receipt});
   }catch(error){reject(error);}});
  });
  req.on('timeout',()=>req.destroy(new Error('WORKER_TIMEOUT')));
  req.on('error',reject);
  req.end(body);
 });
}
