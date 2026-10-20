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
