/** Isolated 24kHz mono PCM16 stream. NEVER send to station encoder. */
export function createMchsLabPcmStream(res,session,{maxMs=60000}={}){
 const rate=24000,frames=480;
 let phase='IDLE',sample=0,closed=false,elapsed=0;
 res.writeHead(200,{'Content-Type':'application/octet-stream','Cache-Control':'no-store, no-transform',
   'X-Content-Type-Options':'nosniff','X-Lab-Format':'s16le;rate=24000;channels=1','X-Accel-Buffering':'no'});
 const end=()=>{if(closed)return;closed=true;clearInterval(timer);if(!res.writableEnded)res.end();};
 const timer=setInterval(()=>{
  if(closed||res.destroyed)return end();
  elapsed+=20;if(elapsed>maxMs)return end();
  const state=session.status();
  const buffer=Buffer.alloc(frames*2);
  if(state.phase!==phase){phase=state.phase;sample=0;}
  for(let i=0;i<frames;i++){
   const t=sample/rate;
   const fade=Math.min(1,sample/240);
   const v=phase==='PROGRAM'?(Math.sin(2*Math.PI*220*t)*0.09+Math.sin(2*Math.PI*330*t)*0.035):
     phase==='ALERT'?Math.sin(2*Math.PI*740*t)*0.13:0;
   buffer.writeInt16LE(Math.round(v*fade*32767),i*2);sample++;
  }
  // On slow clients terminate rather than accumulating audio indefinitely.
  if(!res.write(buffer))end();
 },20);
 timer.unref?.();
 res.on('close',end);
 return end;
}
