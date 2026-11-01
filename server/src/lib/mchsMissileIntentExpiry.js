/** Staged MCHS intents are not permission to actuate speakers.
 * Expire quickly so an old event never becomes playable after a restart.
 */
export const MCHS_INTENT_TTL_MS=120000;
export function intentExpiryDecision(intent,nowMs=Date.now()){
 if(intent?.status!=='STAGED')return {expire:false,reason:'NOT_STAGED'};
 const created=Date.parse(intent.createdAt);
 if(!Number.isFinite(created))return {expire:true,reason:'UNKNOWN_CREATION_TIME'};
 if(created>nowMs+30000)return {expire:true,reason:'FUTURE_CREATION_TIME'};
 if(nowMs-created>=MCHS_INTENT_TTL_MS)return {expire:true,reason:'STALE_INTENT'};
 return {expire:false,reason:'FRESH_STAGED_INTENT'};
}
