/** Compare the remaining emitted PCM window against the authoritative schedule clock.
 * A track's initial remainingMs must never be compared directly to Date.now()
 * after seconds of PCM have already reached the encoder.
 */
export function pcmBoundaryDriftMs({remainingMs,emittedBytes,boundaryMs,nowMs,bytesPerMs}={}){
 if(![remainingMs,emittedBytes,boundaryMs,nowMs,bytesPerMs].every(Number.isFinite)||
    remainingMs<0||emittedBytes<0||bytesPerMs<=0)return Infinity;
 return (remainingMs-emittedBytes/bytesPerMs)-(boundaryMs-nowMs);
}
export function isPcmBoundaryAligned(input,{toleranceMs=900}={}){
 return Math.abs(pcmBoundaryDriftMs(input))<toleranceMs;
}

/** A checked source reservation remains usable across the PCM overlap entry.
 * This bounds age without silently bypassing slot, playlist or source checks.
 * Only called after the authority query has confirmed the current schedule.
 */
export function reverseAuthorityFresh({confirmedAtMs,nowMs,boundaryMs,maxAgeMs=3500}={}){
 return Number.isFinite(confirmedAtMs)&&confirmedAtMs>0&&
   Number.isFinite(nowMs)&&Number.isFinite(boundaryMs)&&
   nowMs>=confirmedAtMs&&nowMs-confirmedAtMs<maxAgeMs&&nowMs<boundaryMs;
}
