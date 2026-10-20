import {spawn} from 'node:child_process';
import {stat} from 'node:fs/promises';
import {RadioSourcePcmOverlap} from './radioSourcePcmOverlap.js';

/** Isolated two-decoder experiment. Never connects to the public encoder.
 * The runner requires regular existing audio files and limits output size.
 */
export async function rehearseSourceOverlap({
 sourcePath,targetPath,sourceId='AUTO_DJ',targetId='SCHEDULED',
 overlapMs=1500,curve='equalPower',ffmpeg='ffmpeg',timeoutMs=20000
}={}){
 if(!sourcePath||!targetPath||sourcePath===targetPath)
  throw new TypeError('Two distinct audio paths are required');
 if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>120000)
  throw new RangeError('Invalid decoder timeout');
 const [a,b]=await Promise.all([stat(sourcePath),stat(targetPath)]);
 if(!a.isFile()||!b.isFile())throw new TypeError('Regular audio files required');
 const engine=new RadioSourcePcmOverlap({
  source:{id:sourceId,mode:'AUTO_DJ'},target:{id:targetId,mode:'SCHEDULED'},
  overlapMs,curve
 });
 const ready=engine.start({sourceReady:true,targetReady:true,slotAuthority:true});
 if(!ready.ok)throw new Error(ready.reason);
 const seconds=(overlapMs/1000).toFixed(3);
 const args=file=>['-hide_banner','-nostdin','-loglevel','error','-ss','0',
  '-i',file,'-t',seconds,'-vn','-f','s16le','-ac','2','-ar','48000','pipe:1'];
 const children=[spawn(ffmpeg,args(sourcePath),{stdio:['ignore','pipe','pipe']}),
  spawn(ffmpeg,args(targetPath),{stdio:['ignore','pipe','pipe']})];
 const input=[[],[]];const errors=[];
 const run=(child,index)=>new Promise((resolve,reject)=>{
  let stderr='';
  child.stderr.on('data',c=>{stderr=(stderr+c.toString()).slice(-1000);});
  child.stdout.on('data',chunk=>input[index].push(chunk));
  child.once('error',reject);
  child.once('close',code=>code===0?resolve():reject(new Error('FFmpeg deck '+index+' exit '+code+': '+stderr)));
 });
 let timeout;
 try{
  await Promise.race([
   Promise.all(children.map(run)),
   new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Decoder timeout')),timeoutMs);})
  ]);
  const samples=input.map(chunks=>Buffer.concat(chunks));
  const expected=overlapMs*192;
  if(samples.some(pcm=>pcm.length<expected||pcm.length%4)){
   throw new Error('Deck underrun: insufficient aligned PCM');
  }
  const chunkBytes=192*20;
  let mixed=Buffer.alloc(0);
  for(let position=0;position<expected;position+=chunkBytes){
   const size=Math.min(chunkBytes,expected-position);
   const result=engine.push(samples[0].subarray(position,position+size),
     samples[1].subarray(position,position+size));
   mixed=Buffer.concat([mixed,result.pcm]);
  }
  if(!engine.snapshot().closed||mixed.length!==expected)
   throw new Error('Incomplete or duplicated overlap frames');
  return {pcm:mixed,metrics:{status:'COMPLETED',frames:mixed.length/4,
   overlapMs,sourceBytes:samples[0].length,targetBytes:samples[1].length,
   streamedToPublicEncoder:false}};
 }catch(error){
  errors.push(error.message);
  engine.abort(error.message);
  throw error;
 }finally{
  clearTimeout(timeout);
  for(const child of children)if(child.exitCode===null&&!child.killed)child.kill('SIGTERM');
 }
}
