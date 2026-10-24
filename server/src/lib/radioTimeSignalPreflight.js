import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

// Decode a short sample into a discarded pipe. This never writes to the station encoder.
// Reject unreadable assets before the hour rather than discovering errors on-air.
export async function preflightTimeSignal({asset,assetsRoot,ffmpeg='ffmpeg',timeoutMs=3000}){
 if(!asset||asset.category!=='TIME_SIGNAL'||!Number.isFinite(asset.durationMs)||asset.durationMs<1000||asset.durationMs>60000||!asset.storageKey)
  return {ok:false,reason:'INVALID_ASSET'};
 const filename=path.join(assetsRoot,path.basename(asset.storageKey));
 try{await fs.access(filename);}
 catch{return {ok:false,reason:'FILE_MISSING'};}
 return new Promise(resolve=>{
  let done=false,bytes=0,timer;
  const finish=(reason,ok=false)=>{
   if(done)return;done=true;clearTimeout(timer);
   if(!ok)child.kill('SIGKILL');
   resolve({ok,reason,decodedBytes:bytes});
  };
  const child=spawn(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-i',filename,
   '-t','0.25','-vn','-f','s16le','-ar','48000','-ac','2','pipe:1'],{stdio:['ignore','pipe','ignore']});
  timer=setTimeout(()=>finish('DECODER_TIMEOUT'),timeoutMs);
  child.stdout.on('data',chunk=>{bytes+=chunk.length;});
  child.on('error',()=>finish('DECODER_START_FAILED'));
  child.on('close',code=>finish(code===0&&bytes>=48000? 'READY':'DECODE_FAILED',code===0&&bytes>=48000));
 });
}
