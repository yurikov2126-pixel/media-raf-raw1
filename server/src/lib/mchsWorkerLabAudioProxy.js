import http from 'node:http';
/** Authenticated loopback-only fetch of one half-second laboratory session PCM chunk. */
export function fetchMchsWorkerLabChunk(){
 const port=Number(process.env.RADIO_PLAYOUT_PORT||4105);
 const secret=process.env.RADIO_PLAYOUT_SECRET||'';
 if(!Number.isInteger(port)||port<1||port>65535||secret.length<32)return Promise.reject(new Error('WORKER_NOT_CONFIGURED'));
 return new Promise((resolve,reject)=>{
  const request=http.get({hostname:'127.0.0.1',port,path:'/mchs-lab/session/audio.wav',timeout:2500,
   headers:{'x-radio-worker-secret':secret}},res=>{
    if(res.statusCode!==200){res.resume();reject(new Error('WORKER_HTTP_'+res.statusCode));return;}
    let bytes=0;const parts=[];
    res.on('data',chunk=>{bytes+=chunk.length;if(bytes>30000){res.destroy(new Error('CHUNK_TOO_LARGE'));return;}parts.push(chunk);});
    res.on('error',reject);
    res.on('end',()=>{
     const wav=Buffer.concat(parts);
     if(wav.length!==24044||wav.toString('ascii',0,4)!=='RIFF'||wav.toString('ascii',8,12)!=='WAVE')
       return reject(new Error('INVALID_WORKER_CHUNK'));
     resolve({wav,phase:String(res.headers['x-lab-phase']||'IDLE')});
    });
   });
  request.on('timeout',()=>request.destroy(new Error('WORKER_TIMEOUT')));
  request.on('error',reject);
 });
}
