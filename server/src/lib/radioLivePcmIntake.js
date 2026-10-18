/** Bounded local PCM intake staging. Not connected to the station encoder.
 * Signed 16-bit stereo at 48 kHz, with 4-byte frame boundaries.
 */
export class LivePcmIntake {
 constructor({maxBytes=48000*4*2,timeoutMs=15000}={}){
  if(!Number.isSafeInteger(maxBytes)||maxBytes<4||maxBytes%4||!Number.isSafeInteger(timeoutMs)||timeoutMs<1000)
   throw new TypeError('Invalid PCM intake limits');
  this.maxBytes=maxBytes;this.timeoutMs=timeoutMs;this.chunks=[];this.bytes=0;
  this.lastAt=null;this.frames=0;this.droppedBytes=0;
 }
 accept(chunk,nowMs=Date.now()){
  if(!Buffer.isBuffer(chunk)||chunk.length===0||chunk.length%4!==0)throw new TypeError('PCM must contain aligned stereo frames');
  if(chunk.length>this.maxBytes)throw new RangeError('PCM packet exceeds intake capacity');
  while(this.bytes+chunk.length>this.maxBytes){
   const removed=this.chunks.shift();this.bytes-=removed.length;this.droppedBytes+=removed.length;
  }
  this.chunks.push(Buffer.from(chunk));this.bytes+=chunk.length;
  this.frames+=chunk.length/4;this.lastAt=nowMs;
  return {acceptedBytes:chunk.length,bufferedBytes:this.bytes,droppedBytes:this.droppedBytes};
 }
 ready(nowMs=Date.now()){
  return this.bytes>0&&this.lastAt!==null&&nowMs>=this.lastAt&&nowMs-this.lastAt<=this.timeoutMs;
 }
 reset(){this.chunks=[];this.bytes=0;this.lastAt=null;}
 snapshot(nowMs=Date.now()){
  return {ready:this.ready(nowMs),bufferedBytes:this.bytes,droppedBytes:this.droppedBytes,
   frames:this.frames,lastAt:this.lastAt===null?null:new Date(this.lastAt).toISOString()};
 }
}
