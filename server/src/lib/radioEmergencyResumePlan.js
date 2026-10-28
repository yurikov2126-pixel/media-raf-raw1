import {resolveRadioCursor} from './radioTimeline.js';

/** Pure recovery planner: no Worker calls, playout commands, GPIO or side effects. */
export function planRadioEmergencyResume({source,nowMs,slots=[],liveConnected=false,liveAuthorized=false,
  scheduleOptions={},previousTrackId=null,playlistActive=false}={}){
 const deny=(reason)=>({ready:false,reason,action:'RECHECK_STATION_AUTHORITY',simulationOnly:true});
 if(!Number.isFinite(nowMs))return deny('INVALID_CLOCK');
 if(source==='LIVE'){
   if(liveConnected&&liveAuthorized)return {ready:true,action:'RECHECK_LIVE_AUTHORITY',reason:'LIVE_AVAILABLE',simulationOnly:true};
   // Lost LIVE is not proof that AutoDJ is permitted to start; the station timeline must be read again.
   return deny('LIVE_NOT_CONFIRMED');
 }
 if(source==='SCHEDULE'||source==='AUTO_DJ'||source==='MANUAL_PLAYLIST'||source==='AUTO_PLAYLIST'){
   let cursor;
   try{cursor=resolveRadioCursor(slots,nowMs,scheduleOptions);}
   catch{return deny('INVALID_SCHEDULE_DATA');}
   if(cursor.status==='SCHEDULED'&&cursor.slot&&cursor.track)
     return {ready:true,action:'RECHECK_SCHEDULE_AUTHORITY',reason:'CURRENT_SCHEDULED_SLOT',
       slotId:cursor.slot.id,trackId:cursor.track.id,offsetMs:cursor.track.offsetMs,
       simulationOnly:true};
   if(source==='SCHEDULE')return deny('SCHEDULE_SLOT_ENDED_OR_EMPTY');
   if(source==='AUTO_DJ')return {ready:true,action:'RESELECT_AUTODJ_FROM_LIBRARY',reason:'NO_CURRENT_SCHEDULED_SLOT',
     previousTrackId,simulationOnly:true};
   if(playlistActive)return {ready:true,action:'REVALIDATE_PLAYLIST_BEFORE_RESUME',
     reason:'PLAYLIST_AUTHORITY_RECHECK_REQUIRED',simulationOnly:true};
   return deny('PLAYLIST_NO_LONGER_ACTIVE');
 }
 return deny('UNKNOWN_SOURCE');
}
