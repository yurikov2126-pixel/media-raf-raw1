import {prisma} from './prisma.js';
const KEY='radio_source_control_v1';
export const DEFAULT_SOURCE_CONTROL={requestedSource:'AUTO_DJ',liveEnabled:false,heartbeatTimeoutSec:15,autoReturn:true};
export function validateSourceControl(v){
 if(!v||typeof v!=='object'||Array.isArray(v))throw new TypeError('Неверные настройки источника');
 if(!['AUTO_DJ','LIVE'].includes(v.requestedSource))throw new TypeError('Неизвестный источник эфира');
 if(typeof v.liveEnabled!=='boolean'||typeof v.autoReturn!=='boolean')throw new TypeError('Неверная настройка источника');
 if(!Number.isInteger(v.heartbeatTimeoutSec)||v.heartbeatTimeoutSec<5||v.heartbeatTimeoutSec>60)
  throw new TypeError('Таймаут: 5–60 секунд');
 return {requestedSource:v.requestedSource,liveEnabled:v.liveEnabled,
  heartbeatTimeoutSec:v.heartbeatTimeoutSec,autoReturn:v.autoReturn};
}
export async function readSourceControl(db=prisma){
 const row=await db.setting.findUnique({where:{key:KEY}});
 try{return validateSourceControl({...DEFAULT_SOURCE_CONTROL,...JSON.parse(row?.value||'{}')});}
 catch{return {...DEFAULT_SOURCE_CONTROL};}
}
export async function writeSourceControl(value,db=prisma){
 const settings=validateSourceControl(value);
 await db.setting.upsert({where:{key:KEY},create:{key:KEY,value:JSON.stringify(settings)},
  update:{value:JSON.stringify(settings)}});
 return settings;
}
/** Source priority: approved schedule > valid live source > Auto-DJ > silence.
 * This is a read-only arbitration decision; it cannot connect audio inputs.
 */
export function resolveSourcePriority({settings,scheduled=false,liveConnected=false,
 heartbeatAt=null,nowMs=Date.now(),autoDjEnabled=false}){
 if(scheduled)return {source:'SCHEDULED',reason:'Утверждённая передача по расписанию'};
 const heartbeatMs=heartbeatAt?Date.parse(heartbeatAt):NaN;
 const healthy=liveConnected&&Number.isFinite(heartbeatMs)&&heartbeatMs<=nowMs&&
  nowMs-heartbeatMs<=settings.heartbeatTimeoutSec*1000;
 if(settings.requestedSource==='LIVE'&&settings.liveEnabled){
  if(healthy)return {source:'LIVE_READY',reason:'Источник доступен; PCM-переключение не активировано'};
  if(!settings.autoReturn)return {source:'SILENCE',reason:'Источник ведущего недоступен; автовозврат выключен'};
 }
 return {source:autoDjEnabled?'AUTO_DJ':'SILENCE',
  reason:settings.requestedSource==='LIVE'?'Ведущий не подключён; резервный Авто-DJ':'Обычная музыкальная программа'};
}
