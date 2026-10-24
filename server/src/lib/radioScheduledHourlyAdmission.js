/**
 * Protect approved on-air programmes from wall-clock cursor jumps after
 * inserting hourly speech. This decision does not mutate the schedule.
 */
export function scheduledHourlyAdmission({
  enabled,live=false,slot=null,nowMs,signalDurationMs,fadeMs=1500,
  trackRemainingMs,trackCategory='MUSIC',nextSlotStartMs=null,
  maxDelaySeconds=60,alreadyHandled=false
}={}){
 const deny=reason=>({allowed:false,reason});
 if(!enabled)return deny('DISABLED');
 if(live)return deny('LIVE_PRIORITY');
 if(alreadyHandled)return deny('ALREADY_HANDLED');
 if(!slot?.id||!Number.isFinite(Date.parse(slot.endAt)))return deny('NO_APPROVED_SLOT');
 if(!Number.isFinite(nowMs)||!Number.isFinite(signalDurationMs)||signalDurationMs<1000||signalDurationMs>60000)
  return deny('INVALID_AUDIO_OR_CLOCK');
 if(trackCategory!=='MUSIC')return deny('NON_MUSIC_SOURCE');
 if(!Number.isFinite(trackRemainingMs)||trackRemainingMs<0)return deny('UNKNOWN_REMAINDER');
 const end=Date.parse(slot.endAt);
 const next=Number.isFinite(nextSlotStartMs)?nextSlotStartMs:Infinity;
 const deadline=Math.min(end,next);
 const needed=signalDurationMs+Math.max(0,fadeMs)+500;
 if(deadline-nowMs<needed)return deny('INSUFFICIENT_SLOT_WINDOW');
 const at=new Date(nowMs);
 const minute=at.getUTCMinutes(),second=at.getUTCSeconds();
 if(minute*60+second>maxDelaySeconds)return deny('HOURLY_WINDOW_EXPIRED');
 return {allowed:true,reason:'AUTHORIZED_WINDOW',slotId:slot.id,deadlineMs:deadline,remainingAfterSignalMs:deadline-nowMs-needed};
}
