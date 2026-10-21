// Non-blocking EBU R128 analysis of the actual station MP3 encoder output.
// Separate FFmpeg process: when stalled, discard samples instead of delaying broadcast.
import {spawn} from 'node:child_process';

export function parseEbur128Frame(line){
 if(!/(?:^|\s)M:\s/.test(line)||!/(?:^|\s)I:\s/.test(line))return null;
 const read=pattern=>{const match=line.match(pattern);return match?Number(match[1]):null;};
 const m=read(/(?:^|\s)M:\s*(-?(?:\d+(?:\.\d+)?|inf))/i);
 const i=read(/(?:^|\s)I:\s*(-?(?:\d+(?:\.\d+)?|inf))/i);
 const peakPart=line.match(/(?:^|\s)TPK:\s*([^a-zA-Z]*?)(?:\s*dBFS|$)/);
 const peaks=peakPart?peakPart[1].trim().split(/\s+/).map(Number).filter(Number.isFinite):[];
 return {momentary:m,integrated:i,truePeak:peaks.length?Math.max(...peaks):null};
}

export function createStationLufsMeter({ffmpeg='ffmpeg',enabled=true}={}){
 const state={enabled,status:enabled?'STARTING':'DISABLED',source:'SERVER_MP3_OUTPUT',
  momentary:null,integrated:null,truePeak:null,updatedAt:null,errors:0,discardedChunks:0};
 if(!enabled)return {observe(){},snapshot:()=>({...state}),close(){}};
 const child=spawn(ffmpeg,['-hide_banner','-nostdin','-loglevel','info',
  '-f','mp3','-i','pipe:0','-af','ebur128=peak=true:framelog=info',
  '-f','null','-'],{stdio:['pipe','ignore','pipe']});
 let pending='',alive=true;
 const parse=line=>{
  const result=parseEbur128Frame(line);if(!result)return;
  state.momentary=Number.isFinite(result.momentary)?result.momentary:null;
  state.integrated=Number.isFinite(result.integrated)?result.integrated:null;
  state.truePeak=Number.isFinite(result.truePeak)?result.truePeak:null;
  state.updatedAt=new Date().toISOString();state.status='RUNNING';
 };
 child.stderr.on('data',buf=>{
  pending+=buf.toString();
  const lines=pending.split(/\r?\n/);pending=lines.pop()||'';
  for(const line of lines)parse(line);
  if(pending.length>8192)pending=pending.slice(-8192);
 });
 child.stdin.on('error',()=>{alive=false;state.errors++;state.status='UNAVAILABLE';});
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
