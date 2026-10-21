/** End-of-slot gain policy. The fade only acts when a true source-to-source
 * overlap has not been reserved; otherwise leave both decks untouched.
 * Disabled by default until end-to-end broadcast testing.
 */
export function scheduledBoundaryFadePolicy({
 enabled=false,status,isLastTrack=false,usableBlend=false,
 crossfadeEligible=false,remainingMs=Infinity
}={}){
 if(!enabled||status!=='SCHEDULED'||!isLastTrack||usableBlend||
    crossfadeEligible||!Number.isFinite(remainingMs)||remainingMs<=0)
  return {fadeOut:false,fadeMs:0};
 return {fadeOut:true,fadeMs:Math.min(750,Math.max(250,remainingMs))};
}
