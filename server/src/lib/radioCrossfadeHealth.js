/** On-air transition diagnostics for 48 kHz stereo s16le PCM.
 * These metrics are advisory: natural musical pauses are not automatic faults.
 */
export function inspectPcmBoundary(previous,current,{silenceThreshold=24,jumpThreshold=22000}={}){
 if(!Buffer.isBuffer(previous)||!Buffer.isBuffer(current)||previous.length%4||current.length%4)
  throw new TypeError('Expected frame-aligned stereo PCM');
 if(previous.length<4||current.length<4)return {available:false};
 const leftPrevious=previous.readInt16LE(previous.length-4);
 const rightPrevious=previous.readInt16LE(previous.length-2);
 const leftCurrent=current.readInt16LE(0);
 const rightCurrent=current.readInt16LE(2);
 const jump=Math.max(Math.abs(leftCurrent-leftPrevious),Math.abs(rightCurrent-rightPrevious));
 const frames=Math.floor(current.length/4);
 let silent=0;
 for(let i=0;i<current.length;i+=4){
  if(Math.max(Math.abs(current.readInt16LE(i)),Math.abs(current.readInt16LE(i+2)))<=silenceThreshold)silent++;
 }
 return {available:true,maxSampleJump:jump,abruptJump:jump>jumpThreshold,
  silenceRatio:frames?silent/frames:0,frames};
}
export function createCrossfadeQualityState(){
 return {inspected:0,suspiciousJumps:0,lastJump:0,lastSilenceRatio:0,
   lastInspectedAt:null};
}
export function observePcmBoundary(state,previous,current,nowMs=Date.now()){
 const result=inspectPcmBoundary(previous,current);
 if(!result.available)return state;
 return {...state,inspected:state.inspected+1,
  suspiciousJumps:state.suspiciousJumps+Number(result.abruptJump),
  lastJump:result.maxSampleJump,lastSilenceRatio:result.silenceRatio,
  lastInspectedAt:new Date(nowMs).toISOString()};
}
