/** Bounded, frame-aligned PCM staging for the persistent radio MP3 encoder.
 * Buffering is per decoder; bytes are never silently replayed at a new boundary.
 * Stereo signed 16-bit PCM => 4 bytes per audio frame.
 */
export class PcmFrameBuffer {
 constructor({frameBytes=4,maxBytes=48000*4*2}={}){
  if(!Number.isSafeInteger(frameBytes)||frameBytes<1||!Number.isSafeInteger(maxBytes)||maxBytes<frameBytes)
   throw new TypeError('Invalid PCM buffering limits');
  this.frameBytes=frameBytes;this.maxBytes=maxBytes;this.pending=Buffer.alloc(0);
  this.totalBytes=0;this.droppedTailBytes=0;
 }
 push(chunk){
  if(!Buffer.isBuffer(chunk))throw new TypeError('PCM chunk must be a Buffer');
  if(this.pending.length+chunk.length>this.maxBytes)throw new RangeError('PCM staging capacity exceeded');
  this.pending=Buffer.concat([this.pending,chunk]);
  const full=this.pending.length-this.pending.length%this.frameBytes;
  if(!full)return null;
  const output=this.pending.subarray(0,full);
  this.pending=Buffer.from(this.pending.subarray(full));
  this.totalBytes+=output.length;
  return output;
 }
 finish(){
  this.droppedTailBytes+=this.pending.length;
  this.pending=Buffer.alloc(0);
 }
 get bufferedBytes(){return this.pending.length;}
}
