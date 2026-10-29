import http from 'node:http';
/** Loopback-only controlled laboratory endpoint. Never reaches station audio output. */
export function workerMchsSessionRequest(action=null){
 const port=Number(process.env.RADIO_PLAYOUT_PORT||4105),secret=process.env.RADIO_PLAYOUT_SECRET||'';
 if(!Number.isInteger(port)||port<1||port>65535||secret.length<32)return Promise.reject(new Error('WORKER_NOT_CONFIGURED'));
 if(action!==null&&!['START','INTERRUPT','RESUME','STOP'].includes(action))return Promise.reject(new Error('INVALID_ACTION'));
 return new Promise((resolve,reject)=>{
  const data=action===null?null:JSON.stringify({action});
  const req=http.request({hostname:'127.0.0.1',port,path:'/mchs-lab/session',method:action===null?'GET':'POST',timeout:3500,
   headers:{'x-radio-worker-secret':secret,...(data?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}:{})}},res=>{
   let body='',bytes=0;
   res.on('data',chunk=>{bytes+=chunk.length;if(bytes>4096){res.destroy(new Error('RESPONSE_TOO_LARGE'));return;}body+=chunk;});
   res.on('error',reject);
   res.on('end',()=>{
    if(res.statusCode!==200&&res.statusCode!==409)return reject(new Error('WORKER_HTTP_'+res.statusCode));
    try{resolve({httpStatus:res.statusCode,data:JSON.parse(body)});}catch{reject(new Error('WORKER_INVALID_JSON'));}
   });
  });
  req.on('timeout',()=>req.destroy(new Error('WORKER_TIMEOUT')));
  req.on('error',reject);
  req.end(data||undefined);
 });
}
