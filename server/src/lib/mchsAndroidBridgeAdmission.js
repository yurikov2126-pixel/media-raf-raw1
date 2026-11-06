/** A signed Android bridge message may be admitted to the *existing* queue
 * only for an explicitly configured source channel and recent Tula missile
 * danger / all-clear. "verified" denotes bridge-channel admission; it does
 * NOT attest to official authorship or guarantee audible station output.
 */
export function admitAuthenticatedAndroidObservation(provenance){
 return provenance?.bridgeAuthenticated===true&&provenance?.acceptable===true&&
  ['MISSILE_DANGER','MISSILE_ALL_CLEAR'].includes(provenance?.eventType);
}
