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
 if(input.error!==undefined&&(typeof input.error!=='string'||input.error.length>300))return null;
 return {playback,outputDevice:input.outputDevice,
  lastPacketAgeMs:lastPacketAgeMs??null,error:input.error||null};
}
export function audioHealth(report,nowMs=Date.now()){
 if(!report)return {status:'UNKNOWN',reason:'NO_REPORT',lastReportAt:null,ageMs:null};
 const age=Date.parse(report.receivedAt);
 if(!Number.isFinite(age))return {status:'UNKNOWN',reason:'INVALID_TIMESTAMP',lastReportAt:null,ageMs:null};
 const ageMs=Math.max(0,nowMs-age);
 if(ageMs>AUDIO_REPORT_MAX_AGE_MS)return {status:'STALE',reason:'AUDIO_TELEMETRY_STALE',lastReportAt:report.receivedAt,ageMs};
 if(report.playback==='ERROR')return {status:'ERROR',reason:report.error||'PLAYBACK_ERROR',lastReportAt:report.receivedAt,ageMs};
 if(report.playback==='PLAYING'&&report.lastPacketAgeMs!==null&&report.lastPacketAgeMs>15000)return {status:'DEGRADED',reason:'NO_RECENT_AUDIO_PACKET',lastReportAt:report.receivedAt,ageMs};
 return {status:report.playback,reason:null,lastReportAt:report.receivedAt,ageMs};
}
