/** Stateful, per-listener fixture player; isolated from every on-air mixer. */
export function createMchsFixturePcmRenderer(store,{frames=480}={}){
 if(frames!==480)throw new Error('INVALID_FRAME_SIZE');
 let phase='IDLE',revision=-1,version=-1,musicPosition=0,voicePosition=0,fade=0;
 const read=(kind,position)=>{
  const data=store.get(kind);
  if(!data||position>=((data.length-44)/2))return 0;
  return data.readInt16LE(44+position*2);
 };
 return {
  render(state){
   if(store.version()!==version){version=store.version();musicPosition=0;voicePosition=0;fade=0;}
   if(state.revision!==revision||state.phase!==phase){
    const previous=phase;phase=state.phase;revision=state.revision;fade=0;
    if(phase==='IDLE'){musicPosition=0;voicePosition=0;}
    else if(phase==='PROGRAM'&&previous==='IDLE'){musicPosition=0;voicePosition=0;}
    else if(phase==='ALERT'){voicePosition=0;}
    // ALERT → PROGRAM resumes saved musicPosition without advancing during alert.
   }
   const out=Buffer.alloc(frames*2);
   for(let i=0;i<frames;i++){
    let sample=0;
    if(phase==='PROGRAM'){
     const file=store.get('music');
     if(file){
      const count=(file.length-44)/2;
      if(count>0){if(musicPosition>=count)musicPosition=0;sample=read('music',musicPosition++);}
     }
    }else if(phase==='ALERT'){
     sample=read('trainingVoice',voicePosition++);
     // Voice does not loop. After its end the isolated monitor stays silent until RESUME/STOP.
    }
    const gain=Math.min(1,fade/240);fade++;
    out.writeInt16LE(Math.round(sample*gain),i*2);
   }
   return out;
  },
  diagnostic(){return {phase,musicPosition,voicePosition,revision,fixtureVersion:version};}
 };
}
