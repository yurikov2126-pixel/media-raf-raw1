/** Ephemeral laboratory-only PCM fixtures; never references station playout.
 * WAV constraints: RIFF PCM16 mono 24kHz, <= 10 seconds, <= 480044 bytes.
 */
export function createMchsLabFixtureStore(){
 const fixtures=new Map();
 function validate(buffer){
  if(!Buffer.isBuffer(buffer)||buffer.length<44||buffer.length>480044)throw new Error('INVALID_SIZE');
  if(buffer.toString('ascii',0,4)!=='RIFF'||buffer.toString('ascii',8,12)!=='WAVE'||
   buffer.toString('ascii',12,16)!=='fmt '||buffer.readUInt32LE(16)!==16||
   buffer.readUInt16LE(20)!==1||buffer.readUInt16LE(22)!==1||
   buffer.readUInt32LE(24)!==24000||buffer.readUInt16LE(34)!==16||
   buffer.readUInt16LE(32)!==2||buffer.readUInt32LE(28)!==48000||
   buffer.toString('ascii',36,40)!=='data'||buffer.readUInt32LE(40)!==buffer.length-44||
   buffer.readUInt32LE(4)!==buffer.length-8)throw new Error('INVALID_WAV_FORMAT');
  return buffer.length;
 }
 return {
  put(kind,bytes){
   if(!['music','trainingVoice'].includes(kind))throw new Error('INVALID_KIND');
   validate(bytes);fixtures.set(kind,Buffer.from(bytes));
   return {kind,size:bytes.length,seconds:(bytes.length-44)/48000,stored:'MEMORY_ONLY',connectedToStation:false};
  },
  status(){return Object.fromEntries(['music','trainingVoice'].map(k=>[k,fixtures.has(k)?{size:fixtures.get(k).length,seconds:(fixtures.get(k).length-44)/48000}:null]));},
  clear(){fixtures.clear();}
 };
}
