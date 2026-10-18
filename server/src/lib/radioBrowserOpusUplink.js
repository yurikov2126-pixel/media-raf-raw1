/** Guard for browser MediaRecorder WebM/Opus uplink (not a public radio source).
 * Protect against unbounded memory and stale/out-of-order chunks before decoding.
 */
export class BrowserOpusUplink {
 constructor({maxChunkBytes=128*1024,timeoutMs=10000}={}){
  this.maxChunkBytes=maxChunkBytes;this.timeoutMs=timeoutMs;this.reset();
 }
 reset(){this.sequence=0;this.lastAt=null;this.acceptedBytes=0;this.rejected=0;this.active=false;}
 start(nowMs=Date.now()){this.reset();this.active=true;this.lastAt=nowMs;}
 receive(chunk,sequence,nowMs=Date.now()){
  if(!this.active||this.lastAt===null||nowMs<this.lastAt||nowMs-this.lastAt>this.timeoutMs)
   return this.reject('STALE_SESSION');
  if(!Buffer.isBuffer(chunk)||!chunk.length||chunk.length>this.maxChunkBytes)
   return this.reject('INVALID_CHUNK');
  if(!Number.isSafeInteger(sequence)||sequence!==this.sequence)return this.reject('OUT_OF_ORDER');
  this.sequence++;this.lastAt=nowMs;this.acceptedBytes+=chunk.length;
  return {accepted:true,bytes:chunk.length,nextSequence:this.sequence};
 }
 reject(reason){this.rejected++;return {accepted:false,reason};}
 snapshot(nowMs=Date.now()){return {active:this.active&&this.lastAt!==null&&nowMs-this.lastAt<=this.timeoutMs,
  acceptedBytes:this.acceptedBytes,expectedSequence:this.sequence,rejected:this.rejected};}
}
