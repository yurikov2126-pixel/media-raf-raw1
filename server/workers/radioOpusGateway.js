import http from 'node:http';
import {createReadStream} from 'node:fs';
import {createOpusPcmDecoder,pcmPacketize} from '../src/lib/radioOpusPcmGateway.js';
/** Offline trusted source proof-of-concept. Never accepts incoming HTTP.
 * Use ONLY isolated loopback Worker with RADIO_LIVE_PCM_INTAKE_ENABLED=true.
 * Usage: RADIO_PLAYOUT_SECRET=... node workers/radioOpusGateway.js /path/to/test.webm
 */
const file=process.argv[2];
if(!file||!file.endsWith('.webm'))throw new Error('Provide a local .webm audio test fixture');
const secret=process.env.RADIO_PLAYOUT_SECRET||'';
if(secret.length<32)throw new Error('Missing strong worker secret');
const port=Number(process.env.RADIO_PLAYOUT_PORT||4105);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid port');
const request=(method,route,body=null,extra={})=>new Promise((resolve,reject)=>{
 const req=http.request({hostname:'127.0.0.1',port,path:route,method,headers:{
  'x-radio-worker-secret':secret,...extra,...(body?{'content-type':'application/octet-stream','content-length':body.length}:{})}},
  res=>{const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>{
   const raw=Buffer.concat(chunks).toString();
   if(res.statusCode<200||res.statusCode>=300)return reject(new Error('Worker rejected '+route+' ('+res.statusCode+')'));
   try{resolve(raw?JSON.parse(raw):{});}catch(reject){}
  });});
 req.on('error',reject);req.end(body);
});
let session=null,decoder=null;
try{
 const start=await request('POST','/live-pcm/session',null,{'x-radio-session-owner':'offline-opus-test'});
 session=start.sessionToken;
 if(typeof session!=='string')throw new Error('Worker returned no session token');
 decoder=createOpusPcmDecoder();
 let stderr='';
 decoder.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(-2000);});
 createReadStream(file).pipe(decoder.stdin);
 let packets=0,frames=0;
 for await(const {pcm,frameIndex} of pcmPacketize(decoder.stdout)){
  await request('POST','/live-pcm/ingest',pcm,{'x-radio-session-token':session,
   'x-radio-pcm-frame-index':String(frameIndex)});
  packets++;frames+=pcm.length/4;
 }
 const exitCode=await new Promise(resolve=>decoder.once('close',resolve));
 if(exitCode!==0)throw new Error('Decoder failed (code '+exitCode+'): '+stderr);
 console.log('Offline PCM intake verified: '+packets+' packets / '+frames+' frames. Not connected to broadcast.');
}finally{
 if(decoder&&!decoder.killed)decoder.kill('SIGTERM');
 if(session)await request('DELETE','/live-pcm/session',null,{'x-radio-session-token':session}).catch(()=>{});
}
