/** Frame-aligned delay buffer for live decoder PCM.
 * Keep only audio that has NOT reached the station encoder.
 * The caller owns authority and must explicitly flush on cancellation.
 */
export class RadioDeferredPcmTail {
 constructor({holdMs=1500,frameBytes=4,bytesPerMs=192}={}){
  if(!Number.isSafeInteger(holdMs)||holdMs<250||holdMs>5000||
   frameBytes!==4||bytesPerMs!==192)throw new RangeError('Invalid PCM hold configuration');
  this.limit=holdMs*bytesPerMs;this.pending=Buffer.alloc(0);this.emittedBytes=0;
 }
 push(chunk){
  if(!Buffer.isBuffer(chunk)||chunk.length%4)throw new TypeError('Expected frame-aligned PCM');
  this.pending=Buffer.concat([this.pending,chunk]);
  const length=Math.max(0,this.pending.length-this.limit);
  const committed=Buffer.from(this.pending.subarray(0,length));
  this.pending=Buffer.from(this.pending.subarray(length));
  this.emittedBytes+=committed.length;
  return committed;
 }
 takeTail(){
  const tail=this.pending;this.pending=Buffer.alloc(0);return tail;
 }
 flush(){const bytes=this.pending;this.pending=Buffer.alloc(0);this.emittedBytes+=bytes.length;return bytes;}
 snapshot(){return {heldBytes:this.pending.length,emittedBytes:this.emittedBytes,limitBytes:this.limit};}
}
