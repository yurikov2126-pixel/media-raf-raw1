/** PCM source fades for the continuous Radio Playout Worker.
 * 48 kHz, stereo, signed 16-bit little-endian; four bytes per sample frame.
 * Gain is applied before encoding so website and Windows Agent hear the same ramp.
 */
export const PCM_BYTES_PER_MS=192;
export const DEFAULT_SOURCE_FADE_MS=1200;
export function fadePcmChunk(chunk,{positionBytes=0,totalBytes=0,fadeMs=DEFAULT_SOURCE_FADE_MS,fadeIn=true,fadeOut=true}={}) {
  if(!Buffer.isBuffer(chunk))throw new TypeError('PCM must be Buffer');
  if(!Number.isFinite(positionBytes)||positionBytes<0||!Number.isFinite(totalBytes)||totalBytes<0||
     !Number.isFinite(fadeMs)||fadeMs<0||fadeMs>5000)throw new RangeError('Invalid PCM fade values');
  if(!fadeMs||(!fadeIn&&!fadeOut)||!chunk.length)return chunk;
  if(chunk.length%4)throw new RangeError('PCM stereo samples must be frame-aligned');
  const fadeFrames=Math.max(1,Math.round(fadeMs*48));
  const totalFrames=Math.max(0,Math.floor(totalBytes/4));
  const firstFrame=Math.floor(positionBytes/4);
  const result=Buffer.from(chunk);
  for(let i=0;i<result.length;i+=4){
    const frame=firstFrame+i/4;
    const inGain=fadeIn?Math.min(1,(frame+1)/fadeFrames):1;
    const outGain=fadeOut?Math.min(1,Math.max(0,(totalFrames-frame)/fadeFrames)):1;
    // Both transitions should not raise gain over unity, even for short clips.
    const gain=Math.min(inGain,outGain);
    if(gain>=1)continue;
    for(let c=0;c<4;c+=2){
      const original=result.readInt16LE(i+c);
      result.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(original*gain))),i+c);
    }
  }
  return result;
}
