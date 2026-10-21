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
  momentary:null,integrated:null,truePeak:null,updatedAt:null,errors:0,discardedChunks:0,lastError:null,firstBytesAt:null,receivedChunks:0,parsedFrames:0};
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
  state.updatedAt=new Date().toISOString();state.status='RUNNING';state.parsedFrames++;
 };
 child.stderr.on('data',buf=>{
  pending+=buf.toString();
  const lines=pending.split(/[\r\n]+/);pending=lines.pop()||'';
  for(const line of lines)parse(line);
  if(pending.length>8192)pending=pending.slice(-8192);
 });
 child.stdin.on('error',error=>{alive=false;state.errors++;state.lastError=error.message;state.status='UNAVAILABLE';});
 child.on('error',error=>{alive=false;state.errors++;state.lastError=error.message;state.status='UNAVAILABLE';});
 child.on('exit',(code,signal)=>{alive=false;state.status='UNAVAILABLE';state.lastError=state.lastError||'FFmpeg exited: '+(signal||code);});
 return {
  observe(buffer){
   if(!alive||child.stdin.destroyed){state.discardedChunks++;return;}
   // MP3 is a continuous compressed bitstream. Dropping individual chunks desynchronizes the decoder.
   // Keep a bounded queue; on excessive backlog disable only telemetry, never the actual broadcast.
   if(child.stdin.writableLength>2*1024*1024){state.discardedChunks++;state.status='OVERLOADED';state.lastError='LUFS analyzer backlog exceeds 2 MiB';alive=false;child.kill();return;}
   try{child.stdin.write(buffer);state.receivedChunks++;if(!state.firstBytesAt)state.firstBytesAt=new Date().toISOString();}
   catch(error){state.discardedChunks++;state.errors++;state.lastError=error.message;}
  },
  snapshot(){return {...state,stale:!state.updatedAt||Date.now()-Date.parse(state.updatedAt)>5000};},
  close(){alive=false;child.stdin.end();child.kill();}
 };
}
