// Optional, authenticated Windows agent playback telemetry.
// A heartbeat alone does not prove audio rendering; report independent signals.
export const AUDIO_REPORT_MAX_AGE_MS=20000;
const allowed=['PLAYING','BUFFERING','STOPPED','ERROR','UNKNOWN'];
export function validateAudioReport(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const playback=typeof input.playback==='string'?input.playback.toUpperCase():'';
 if(!allowed.includes(playback))return null;
 if(typeof input.outputDevice!=='string'||input.outputDevice.length>120)return null;
 const lastPacketAgeMs=input.lastPacketAgeMs;
 if(lastPacketAgeMs!==null&&lastPacketAgeMs!==undefined&&(!Number.isInteger(lastPacketAgeMs)||lastPacketAgeMs<0||lastPacketAgeMs>86400000))return null;
 if(input.source!==undefined&&!['CENTRAL','LOCAL_RESERVE','NONE'].includes(input.source))return null;
 if(input.outputEndpoint!==undefined){
  const endpoint=input.outputEndpoint;
  if(!endpoint||typeof endpoint!=='object'||Array.isArray(endpoint)||
   !['AVAILABLE','UNAVAILABLE','UNKNOWN','UNSUPPORTED'].includes(endpoint.state)||
   (endpoint.name!==null&&endpoint.name!==undefined&&(typeof endpoint.name!=='string'||endpoint.name.length>120))||
   (endpoint.count!==null&&endpoint.count!==undefined&&(!Number.isInteger(endpoint.count)||endpoint.count<0||endpoint.count>100)))return null;
 }
 if(input.error!==undefined&&(typeof input.error!=='string'||input.error.length>300))return null;
 return {playback,source:input.source||'UNKNOWN',outputDevice:input.outputDevice,
  lastPacketAgeMs:lastPacketAgeMs??null,outputEndpoint:input.outputEndpoint??null,error:input.error||null};
}
export function audioHealth(report,nowMs=Date.now()){
 if(!report)return {status:'UNKNOWN',reason:'NO_REPORT',source:'UNKNOWN',outputDevice:null,lastPacketAgeMs:null,outputEndpoint:null,lastReportAt:null,ageMs:null};
 const age=Date.parse(report.receivedAt);
 if(!Number.isFinite(age))return {status:'UNKNOWN',reason:'INVALID_TIMESTAMP',source:'UNKNOWN',outputDevice:null,lastPacketAgeMs:null,lastReportAt:null,ageMs:null};
 const ageMs=Math.max(0,nowMs-age);
 const context={source:report.source||'UNKNOWN',outputDevice:report.outputDevice||null,lastPacketAgeMs:report.lastPacketAgeMs??null,outputEndpoint:report.outputEndpoint??null};
 if(ageMs>AUDIO_REPORT_MAX_AGE_MS)return {...context,status:'STALE',reason:'AUDIO_TELEMETRY_STALE',lastReportAt:report.receivedAt,ageMs};
 if(report.playback==='ERROR')return {...context,status:'ERROR',reason:report.error||'PLAYBACK_ERROR',lastReportAt:report.receivedAt,ageMs};
 if(report.playback==='PLAYING'&&report.lastPacketAgeMs!==null&&report.lastPacketAgeMs>15000)return {...context,status:'DEGRADED',reason:'NO_RECENT_AUDIO_PACKET',lastReportAt:report.receivedAt,ageMs};
 return {...context,status:report.playback,reason:null,lastReportAt:report.receivedAt,ageMs};
}
