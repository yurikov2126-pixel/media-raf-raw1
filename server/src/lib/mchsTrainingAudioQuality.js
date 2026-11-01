/** Read-only assessment. Zero observed stalls is not proof that Agent playback worked. */
export function assessTrainingAudioQuality({clock,overlay}={}){
 const frames=clock?.frames,gaps=clock?.gaps,maxDelayMs=clock?.maxDelayMs;
 if(!Number.isSafeInteger(frames)||frames<1||!Number.isSafeInteger(gaps)||gaps<0||
    !Number.isFinite(maxDelayMs)||maxDelayMs<0)
  return {state:'NO_MEASUREMENT',browserPlaybackVerified:false,agentPlaybackVerified:false};
 const finished=overlay?.lastStopReason==='FILE_COMPLETED';
 return {state:finished&&gaps===0?'PCM_FEED_STABLE':gaps>0?'PCM_FEED_GAPS':'NOT_COMPLETED',
  frames,gaps,maxDelayMs,completed:finished,
  browserPlaybackVerified:false,agentPlaybackVerified:false};
}
