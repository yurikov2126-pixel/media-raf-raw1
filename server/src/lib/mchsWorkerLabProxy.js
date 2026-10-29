import http from 'node:http';

/** Read-only binary fetch for the isolated Worker lab only. */
export function fetchWorkerMchsLabWav({port=Number(process.env.RADIO_PLAYOUT_PORT||4105),secret=process.env.RADIO_PLAYOUT_SECRET||''}={}){
 if(!Number.isInteger(port)||port<1||port>65535||secret.length<32)
   return Promise.reject(new Error('WORKER_NOT_CONFIGURED'));
 return new Promise((resolve,reject)=>{
  const req=http.get({hostname:'127.0.0.1',port,path:'/mchs-lab/handover.wav',timeout:3500,
   headers:{'x-radio-worker-secret':secret}},res=>{
   if(res.statusCode!==200){res.resume();reject(new Error('WORKER_HTTP_'+res.statusCode));return;}
   const chunks=[];let bytes=0;
   res.on('data',chunk=>{bytes+=chunk.length;if(bytes>750000){res.destroy(new Error('LAB_WAV_TOO_LARGE'));return;}chunks.push(chunk);});
   res.on('error',reject);
   res.on('end',()=>{
    const wav=Buffer.concat(chunks);
    if(wav.length<44||wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE')
      return reject(new Error('INVALID_WORKER_AUDIO'));
    resolve(wav);
   });
  });
  req.on('timeout',()=>req.destroy(new Error('WORKER_TIMEOUT')));
  req.on('error',reject);
 });
}
