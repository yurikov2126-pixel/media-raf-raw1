export const INTENT_LEASE_MS=15000;
export const CLAIMABLE_STATUSES=new Set(['STAGED']);
/** Decisions only: delivery is disabled until a separate authenticated executor exists. */
export function assessIntentClaim(intent,{nowMs=Date.now(),ttlMs=120000}={}){
 if(!intent||!CLAIMABLE_STATUSES.has(intent.status))return {allowed:false,reason:'NOT_STAGED'};
 const created=Date.parse(intent.createdAt);
 if(!Number.isFinite(created)||created>nowMs+30000||nowMs-created>=ttlMs)return {allowed:false,reason:'STALE_INTENT'};
 if(intent.leaseUntil&&Date.parse(intent.leaseUntil)>nowMs)return {allowed:false,reason:'LEASE_ACTIVE'};
 if(!['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(intent.eventType))return {allowed:false,reason:'TYPE_NOT_ALLOWED'};
 return {allowed:true,reason:null};
}
export function assessIntentAcknowledgement(intent,token,{nowMs=Date.now()}={}){
 if(!intent||intent.status!=='LEASED')return {allowed:false,reason:'NOT_LEASED'};
 if(!token||token!==intent.leaseToken)return {allowed:false,reason:'LEASE_TOKEN_MISMATCH'};
 if(!intent.leaseUntil||Date.parse(intent.leaseUntil)<nowMs)return {allowed:false,reason:'LEASE_EXPIRED'};
 return {allowed:true,reason:null};
}
