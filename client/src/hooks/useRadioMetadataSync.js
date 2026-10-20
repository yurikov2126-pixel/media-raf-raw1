import {useEffect,useRef,useState} from 'react';

const KEY='mrr-radio-metadata-sync-v1';
const FALLBACK_DELAY=8;
const MAX_DELAY=30;
const clamp=(v)=>Math.min(MAX_DELAY,Math.max(0,Number(v)||0));
export function metadataAt(history, now, seconds){
 if (!history.length) return null;
 const cutoff=now-clamp(seconds)*1000;
 return [...history].reverse().find(item=>item.receivedAt<=cutoff)?.payload||history[0].payload;
}
export function estimateAudioBufferSeconds(audio){
 // Buffered ranges of an unseekable MP3 live stream often do not represent
 // server-to-speaker latency. Only use a finite seekable range.
 if (!audio || !audio.seekable?.length || !audio.buffered?.length) return null;
 try {
  const edge=audio.seekable.end(audio.seekable.length-1);
  const position=audio.currentTime;
  const seconds=edge-position;
  return Number.isFinite(seconds)&&seconds>=0&&seconds<=MAX_DELAY?seconds:null;
 } catch {return null;}
}
function readConfig(){
 try {
  const value=JSON.parse(localStorage.getItem(KEY)||'null');
  if (value && ['auto','manual','off'].includes(value.mode))
   return {mode:value.mode,manualDelay:clamp(value.manualDelay)};
 } catch {/* storage can be disabled */}
 return {mode:'auto',manualDelay:FALLBACK_DELAY};
}
export function useRadioMetadataSync(audioRef){
 const [config,setConfig]=useState(readConfig);
 const [history,setHistory]=useState([]);
 const [now,setNow]=useState(Date.now());
 const [measured,setMeasured]=useState(null);
 const latest=useRef(null);
 useEffect(()=>{
  const timer=setInterval(()=>{
   setNow(Date.now());
   const sample=estimateAudioBufferSeconds(audioRef?.current);
   setMeasured(sample);
  },1000);
  return ()=>clearInterval(timer);
 },[audioRef]);
 useEffect(()=>{
  try {localStorage.setItem(KEY,JSON.stringify(config));}catch {/* ignore */}
 },[config]);
 useEffect(()=>{
  const onStorage=(event)=>{if(event.key===KEY)setConfig(readConfig());};
  window.addEventListener('storage',onStorage);
  return ()=>window.removeEventListener('storage',onStorage);
 },[]);
 const ingest=(payload)=>{
  const stamp=Date.now();
  latest.current=payload;
  setHistory(items=>[...items.filter(x=>stamp-x.receivedAt<120000),{receivedAt:stamp,payload}]);
 };
 const delay=config.mode==='off'?0:config.mode==='manual'?config.manualDelay:measured??config.manualDelay;
 const display=metadataAt(history,now,delay);
 const effective=display||latest.current;
 const waiting=Boolean(history.length && history[0].receivedAt>now-delay*1000);
 return {ingest,display:effective,delay,config,setConfig,
  automaticMeasured:config.mode==='auto'&&measured!==null,waiting,now};
}
