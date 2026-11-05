import fs from 'node:fs';
import path from 'node:path';
/** Append-and-fsync terminal evidence, fail closed on corruption. */
export function createMchsStationTerminalJournal(file=path.resolve('private/mchs-station-terminal.jsonl')){
 let fd,records=[],error=null;
 try{
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  fd=fs.openSync(file,'a+',0o600);
  const raw=fs.readFileSync(file,'utf8');
  if(raw&&!raw.endsWith('\n'))throw Error('INCOMPLETE_RECORD');
  for(const line of raw.split('\n')){
   if(!line)continue;
   const row=JSON.parse(line);
   if(!['COMPLETE','FAILED'].includes(row.phase)||!/^[\w-]{1,128}$/.test(row.eventId))throw Error('BAD_RECORD');
   records.push(row);
  }
 }catch(e){error=e.message;}
 const append=row=>{
  if(error)return {ok:false,reason:error};
  if(!['COMPLETE','FAILED'].includes(row?.phase)||!/^[\w-]{1,128}$/.test(row?.eventId||''))
   return {ok:false,reason:'INVALID_TERMINAL'};
  if(records.some(r=>r.eventId===row.eventId))return {ok:false,reason:'DUPLICATE'};
  try{
   const data=Buffer.from(JSON.stringify({...row,recordedAt:new Date().toISOString()})+'\n');
   fs.writeSync(fd,data,0,data.length,null);
   fs.fsyncSync(fd);
   records.push(row);return {ok:true};
  }catch(e){error=e.message;return {ok:false,reason:error};}
 };
 return {append,history:()=>records.slice(-128),hasEvent:id=>records.some(r=>r.eventId===id),
  status:()=>({healthy:!error,error,records:records.length})};
}
