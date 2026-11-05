import fs from 'node:fs';
import path from 'node:path';
const valid=r=>r&&['COMPLETE','FAILED'].includes(r.phase)&&/^[\\w-]{1,128}$/.test(r.eventId||'')&&
 /^[\\w-]{1,128}$/.test(r.assetId||'')&&['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(r.eventType)&&
 Number.isInteger(r.repeats)&&r.repeats>=1&&r.repeats<=5&&
 Number.isInteger(r.completedRepeats)&&r.completedRepeats>=0&&r.completedRepeats<=r.repeats&&
 (r.phase!=='COMPLETE'||(r.preemptAcknowledged===true&&r.naturalCompletion===true&&
 r.programRestored===true&&r.completedRepeats===r.repeats));
/** Append-and-fsync terminal evidence, fail closed on corruption. */
export function createMchsStationTerminalJournal(file=path.resolve('private/mchs-station-terminal.jsonl')){
 let fd,records=[],seen=new Set(),error=null;
 try{
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  fd=fs.openSync(file,'a+',0o600);
  const raw=fs.readFileSync(file,'utf8');
  if(raw&&!raw.endsWith('\n'))throw Error('INCOMPLETE_RECORD');
  for(const line of raw.split('\n')){
   if(!line)continue;
   const row=JSON.parse(line);
   if(!['COMPLETE','FAILED'].includes(row.phase)||!/^[\w-]{1,128}$/.test(row.eventId))throw Error('BAD_RECORD');
   seen.add(row.eventId);records.push(row);
  }
 }catch(e){error=e.message;}
 const append=row=>{
  if(error)return {ok:false,reason:error};
  if(!['COMPLETE','FAILED'].includes(row?.phase)||!/^[\w-]{1,128}$/.test(row?.eventId||''))
   return {ok:false,reason:'INVALID_TERMINAL'};
  if(seen.has(row.eventId))return {ok:false,reason:'DUPLICATE'};
  try{
   const data=Buffer.from(JSON.stringify({...row,recordedAt:new Date().toISOString()})+'\n');
   let pos=0;
   while(pos<data.length){const n=fs.writeSync(fd,data,pos,data.length-pos,null);
    if(n<=0)throw Error('SHORT_WRITE');pos+=n;}
   fs.fsyncSync(fd);
   seen.add(row.eventId);records.push(row);return {ok:true};
  }catch(e){error=e.message;return {ok:false,reason:error};}
 };
 return {append,history:()=>records.slice(-128),hasEvent:id=>seen.has(id),
  status:()=>({healthy:!error,error,records:records.length})};
}
