/**
 * Frame-aligned bounds for an already armed hourly PCM fade.
 * All byte counters are 48 kHz stereo s16le (4 bytes per frame).
 * Prevents oversize decoder packets from leaking past the fade boundary.
 */
export function boundHourlyPcmChunk({chunkBytes,emittedBytes,cutAtBytes,fadeAtBytes}){
 const valid=n=>Number.isSafeInteger(n)&&n>=0&&n%4===0;
 if(!valid(chunkBytes)||!valid(emittedBytes))throw new RangeError('INVALID_PCM_FRAME');
 if(cutAtBytes===null||cutAtBytes===undefined)return {
   takeBytes:chunkBytes,dropBytes:0,armed:false,complete:false
 };
 if(!valid(cutAtBytes)||!valid(fadeAtBytes)||cutAtBytes<=fadeAtBytes||
    emittedBytes<fadeAtBytes)throw new RangeError('INVALID_HOURLY_FADE');
 const takeBytes=Math.min(chunkBytes,Math.max(0,cutAtBytes-emittedBytes));
 return {takeBytes,dropBytes:chunkBytes-takeBytes,armed:true,
   complete:emittedBytes+takeBytes>=cutAtBytes};
}
/** Do not emit a time signal if a new approved slot replaces the current one. */
export function hourlySlotStillAuthorized({expectedSlotId=null,activeSlotId=null}={}){
 return expectedSlotId?activeSlotId===expectedSlotId:activeSlotId===null;
}
