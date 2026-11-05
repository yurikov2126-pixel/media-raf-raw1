import http from 'node:http';
import {validateMchsStationCommand} from './mchsStationCommandContract.js';

/** Internal API-to-Worker transport. No public Express route or Android hook.
 * START is unavailable until explicit server configuration; Worker independently
 * enforces its own disabled-by-default command gate.
 */
export function requestMchsStationSession(command,{port=Number(process.env.RADIO_PLAYOUT_PORT||4105),
 secret=process.env.RADIO_PLAYOUT_SECRET||'',
 enabled=process.env.MCHS_MAIN_STATION_COORDINATOR_ENABLED==='true',
 timeoutMs=3500}={}){
 const payload=validateMchsStationCommand(command);
 if(!payload.ok)return Promise.resolve({ok:false,reason:payload.reason});
 if(!Number.isInteger(port)||port<1||port>65535||
    typeof secret!=='string'||secret.length<32)
  return Promise.resolve({ok:false,reason:'WORKER_NOT_CONFIGURED'});
 if(payload.action!=='STATUS'&&!enabled)
  return Promise.resolve({ok:false,reason:'COORDINATOR_DISABLED'});
 const data=payload.action==='STATUS'?null:JSON.stringify(payload);
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port,path:'/mchs-station-session',
   method:data?'POST':'GET',timeout:timeoutMs,
   headers:{'x-radio-worker-secret':secret,...(data?{
    'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}:{})}},res=>{
   let body='',length=0;
   res.on('data',chunk=>{
    length+=chunk.length;
    if(length>16384){res.destroy(new Error('WORKER_RESPONSE_TOO_LARGE'));return;}
    body+=chunk;
   });
   res.on('error',reject);
   res.on('end',()=>{
    try{
     const result=JSON.parse(body);
     resolve({ok:res.statusCode===200&&result.ok!==false,
       httpStatus:res.statusCode,data:result});
    }catch{reject(new Error('WORKER_INVALID_RESPONSE'));}
   });
  });
  req.on('timeout',()=>req.destroy(new Error('WORKER_TIMEOUT')));
  req.on('error',reject);
  req.end(data||undefined);
 });
}
