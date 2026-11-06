/** Called only after HMAC authorization and the source-event upsert.
 * The event row MUST include eventType from the Prisma select projection.\n * `verified` is only the eligibility bit for *audio*, not Android HMAC: UAV\n * rows are deliberately verified:false but still must be allowed to PUSH.\n * Caller has already authenticated HMAC and the Android channel.
 */
export function shouldStageMchsPushDelivery({candidate,storedEvent,alreadySaved}={}){
 return candidate?.eligible===true&&alreadySaved!==true&&
  typeof storedEvent?.id==='string'&&storedEvent.id.length>0&&
  storedEvent?.eventType===candidate.type;
}
