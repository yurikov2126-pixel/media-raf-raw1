import {useEffect,useRef,useState} from 'react';
// The WebAudio graph taps the PUBLIC MP3 listener, not the station PCM worker.
export function useRadioLufsMeter(audioRef,playing){
 const [meter,setMeter]=useState({momentary:null,shortTerm:null,state:'idle'});
 const graph=useRef(null);
 const isPlaying=useRef(false);
 isPlaying.current=playing;
 useEffect(()=>{
  if(!playing){setMeter(v=>({...v,momentary:null,shortTerm:null,state:'idle'}));return;}
  let canceled=false;
  const start=async()=>{
   if(graph.current){
    try{await graph.current.ctx.resume();}catch{}
    if(!canceled)setMeter(v=>({...v,state:'warming'}));
    return;
   }
   const element=audioRef.current;
   if(!element||!window.AudioContext||!window.AudioWorkletNode){
    if(!canceled)setMeter(v=>({...v,state:'unsupported'}));return;
   }
   let ctx=null;
   try{
    ctx=new AudioContext({sampleRate:48000});
    if(ctx.sampleRate!==48000)throw Error('sample-rate');
    await ctx.audioWorklet.addModule('/radio-lufs-processor.js');
    if(canceled){await ctx.close();return;}
    const input=ctx.createMediaElementSource(element);
    const worklet=new AudioWorkletNode(ctx,'radio-lufs-meter',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2]});
    const silent=ctx.createGain();silent.gain.value=0;
    input.connect(ctx.destination); // audible playback bypasses the worklet
    input.connect(worklet);worklet.connect(silent);silent.connect(ctx.destination);
    graph.current={ctx,input,worklet,silent};
    worklet.port.onmessage=e=>{
     if(!isPlaying.current)return;
     setMeter({momentary:e.data.momentary,shortTerm:e.data.shortTerm,state:'measuring'});
    };
    await ctx.resume();
    if(!canceled)setMeter(v=>({...v,state:'warming'}));
   }catch{
    if(ctx&&!graph.current)try{await ctx.close();}catch{}
    if(!canceled)setMeter({momentary:null,shortTerm:null,state:'unsupported'});
   }
  };
  void start();
  return()=>{canceled=true;};
 },[audioRef,playing]);
 useEffect(()=>()=>{const g=graph.current;if(g){g.worklet.port.onmessage=null;g.ctx.close().catch(()=>{});graph.current=null;}},[]);
 return meter;
}
