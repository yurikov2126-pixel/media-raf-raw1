// Non-blocking EBU R128 analysis of the actual station MP3 encoder output.
// Separate FFmpeg process: when stalled, discard samples instead of delaying broadcast.
import {spawn} from 'node:child_process';

export function createStationLufsMeter({ffmpeg='ffmpeg',enabled=true}={}){
 const state={enabled,status:enabled?'STARTING':'DISABLED',source:'SERVER_MP3_OUTPUT',
  momentary:null,integrated:null,truePeak:null,updatedAt:null,errors:0,discardedChunks:0};
 if(!enabled)return {observe(){},snapshot:()=>({...state}),close(){}};
 const child=spawn(ffmpeg,['-hide_banner','-nostdin','-loglevel','info',
  '-f','mp3','-i','pipe:0','-af','ebur128=peak=true:framelog=info',
  '-f','null','-'],{stdio:['pipe','ignore','pipe']});
 let pending='',alive=true;
 const parse=line=>{
  // ffmpeg EBU R128 log: M/S/I LUFS, and TPK dBTP.
  if(!line.includes(' M:')||!line.includes(' I:'))return;
  const value=(name)=>{const m=line.match(new RegExp('(?:^|\\s)'+name+':\\s*(-?(?:\\d+(?:\\.\\d+)?|inf))','i'));return m?Number(m[1]):null;};
  const m=value('M'),i=value('I'),tp=value('TPK');
  state.momentary=Number.isFinite(m)?m:null;
  state.integrated=Number.isFinite(i)?i:null;
  state.truePeak=Number.isFinite(tp)?tp:null;
  state.updatedAt=new Date().toISOString();
  state.status='RUNNING';
 };
 child.stderr.on('data',buf=>{
  pending+=buf.toString();
  const lines=pending.split(/\r?\n/);pending=lines.pop()||'';
  for(const line of lines)parse(line);
  if(pending.length>8192)pending=pending.slice(-8192);
 });
 child.on('error',()=>{alive=false;state.errors++;state.status='UNAVAILABLE';});
 child.on('exit',()=>{alive=false;state.status='UNAVAILABLE';});
 return {
  observe(buffer){
   if(!alive||child.stdin.destroyed||child.stdin.writableNeedDrain){
    state.discardedChunks++;return;
   }
   try{child.stdin.write(buffer);}catch{state.discardedChunks++;state.errors++;}
  },
  snapshot(){return {...state,stale:!state.updatedAt||Date.now()-Date.parse(state.updatedAt)>5000};},
  close(){alive=false;child.stdin.end();child.kill();}
 };
}
