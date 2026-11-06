/** Called only after HMAC authorization and the source-event upsert.
 * The event row MUST include eventType from the Prisma select projection.
 */
export function shouldStageMchsPushDelivery({candidate,storedEvent,alreadySaved}={}){
 return candidate?.eligible===true&&alreadySaved!==true&&
  typeof storedEvent?.id==='string'&&storedEvent.id.length>0&&
  storedEvent?.verified===true&&
  storedEvent?.eventType===candidate.type;
}
