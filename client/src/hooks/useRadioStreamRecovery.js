import {useEffect,useRef,useState} from 'react';

// Reconnect the public live stream only while the listener intends to play.
// The Worker can temporarily refuse connections (HTTP 503) during a playout restart.
export function useRadioStreamRecovery(){
 const audioRef=useRef(null);
 const intent=useRef(false);
 const reconnecting=useRef(false);
 const timer=useRef(null);
 const failures=useRef(0);
 const [playing,setPlaying]=useState(false);
 const [error,setError]=useState('');
 const [reconnectingState,setReconnectingState]=useState(false);
 const clear=()=>{if(timer.current!==null){clearTimeout(timer.current);timer.current=null;}};
 const retry=()=>{
  if(!intent.current||timer.current!==null)return;
  reconnecting.current=true;setReconnectingState(true);setPlaying(false);
  const wait=Math.min(15000,1000*Math.pow(2,Math.min(failures.current++,4)));
  setError('Соединение с эфиром прервано. Переподключаемся…');
  timer.current=setTimeout(()=>{
   timer.current=null;
   if(!intent.current)return;
   const node=audioRef.current;if(!node)return;
   node.src='/api/radio-agent/listen?retry='+Date.now();
   node.load();
   node.play().catch(()=>{if(intent.current)retry();});
  },wait);
 };
 useEffect(()=>()=>{intent.current=false;clear();},[]);
 return {
  audioRef,playing,error,reconnecting:reconnectingState,
  audioEvents:{
   onPlay:()=>{intent.current=true;reconnecting.current=false;failures.current=0;clear();setPlaying(true);setReconnectingState(false);setError('');},
   onPause:()=>{setPlaying(false);if(reconnecting.current||audioRef.current?.ended||audioRef.current?.error)return;intent.current=false;clear();setReconnectingState(false);},
   onEnded:()=>retry(),
   onError:()=>{if(intent.current)retry();else setError('Не удалось воспроизвести MP3-поток');}
  }
 };
}
