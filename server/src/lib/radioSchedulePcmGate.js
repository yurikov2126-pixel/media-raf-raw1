/** Bound scheduled PCM immediately before the shared encoder, not only FFmpeg -t.
 * PCM s16le stereo 48 kHz = 192 bytes/ms; slice on whole stereo frames.
 */
export function boundScheduledPcm(chunk, slotEndMs, nowMs=Date.now(), bytesPerSecond=192000) {
  if(!Buffer.isBuffer(chunk))throw new TypeError('PCM chunk must be a Buffer');
  if(!Number.isFinite(slotEndMs) || !Number.isFinite(nowMs) || bytesPerSecond<=0)throw new TypeError('Invalid PCM timing');
  const availableMs=Math.max(0,slotEndMs-nowMs);
  const permitted=Math.max(0,Math.floor(availableMs*bytesPerSecond/1000/4)*4);
  if(permitted===0)return {pcm:Buffer.alloc(0),truncated:chunk.length>0};
  if(permitted>=chunk.length)return {pcm:chunk,truncated:false};
  return {pcm:chunk.subarray(0,permitted),truncated:true};
}
export function postScheduleGuardActive(endAt,nowMs,guardMs=45000){
  const end=Date.parse(endAt);
  return Number.isFinite(end) && nowMs>=end && nowMs<end+guardMs;
}
