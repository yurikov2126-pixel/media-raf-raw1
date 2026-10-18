import {useEffect,useRef,useState} from 'react';
import {planPrivatePcmSchedule} from './radioPrivatePcmClock.js';

/** Headphone-only 48 kHz stereo PCM player. Never sends audio to the Worker. */
export default function RadioPrivateLiveMonitor({socket,active,mode='voice'}){
  const [enabled,setEnabled]=useState(false);
  const [status,setStatus]=useState('Монитор выключен');
  const monitor=useRef(null);
  const stop=()=>{
    const m=monitor.current;monitor.current=null;
    if(m){m.stopped=true;clearTimeout(m.timer);void m.audio.close();}
    setEnabled(false);setStatus('Монитор выключен');
  };
  useEffect(()=>()=>{const m=monitor.current;monitor.current=null;if(m){m.stopped=true;clearTimeout(m.timer);void m.audio.close();}},[]);
  useEffect(()=>{if(!active&&monitor.current){const m=monitor.current;monitor.current=null;m.stopped=true;clearTimeout(m.timer);void m.audio.close();setEnabled(false);setStatus('Сессия ведущего завершена');}},[active]);
  const start=async()=>{
    if(!socket?.connected||!active)return setStatus('Сначала запустите тестовый аудиоканал');
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)return setStatus('Web Audio недоступен');
    const audio=new Context({sampleRate:48000});
    try{await audio.resume();}catch{void audio.close();return setStatus('Не удалось открыть звуковое устройство');}
    const m={audio,stopped:false,timer:null,cursor:null,nextTime:audio.currentTime+0.45,rebufferCount:0};
    monitor.current=m;setEnabled(true);setStatus('Подключение к приватному PCM...');
    const poll=()=>{
      if(m.stopped||monitor.current!==m)return;
      if(!socket.connected){stop();setStatus('Связь прервана');return;}
      socket.timeout(2500).emit(mode==='mix'?'radio:studio:private-mix':'radio:studio:private-live',{after:m.cursor},(err,reply)=>{
        if(m.stopped||monitor.current!==m)return;
        if(err||!reply?.ok){stop();setStatus('Монитор остановлен: '+(reply?.reason||'таймаут'));return;}
        try{
          for(const item of reply.frames){
            if(!Number.isSafeInteger(item.sequence)||(m.cursor!==null&&item.sequence!==m.cursor+1))throw Error('PCM_SEQUENCE_GAP');
            const raw=atob(item.pcmBase64);
            if(raw.length!==3840)throw Error('INVALID_PCM_LENGTH');
            const buffer=audio.createBuffer(2,960,48000);
            const left=buffer.getChannelData(0),right=buffer.getChannelData(1);
            const view=new DataView(new ArrayBuffer(3840));
            for(let i=0;i<3840;i++)view.setUint8(i,raw.charCodeAt(i));
            for(let n=0;n<960;n++){
              left[n]=view.getInt16(n*4,true)/32768;
              right[n]=view.getInt16(n*4+2,true)/32768;
            }
            const node=audio.createBufferSource();
            node.buffer=buffer;node.connect(audio.destination);
            const planned=planPrivatePcmSchedule({nextTime:m.nextTime,currentTime:audio.currentTime});
            if(planned.rebuffered){m.rebufferCount++;m.nextTime=planned.time;}
            node.start(m.nextTime);m.nextTime+=0.02;m.cursor=item.sequence;
          }
          setStatus(m.rebufferCount?'Приватное прослушивание · восстановлений буфера: '+m.rebufferCount+' · эфир не затронут':'Приватное прослушивание · наушники · эфир не затронут');
          // 8 frames = 160ms. Poll faster than that to avoid a deterministic starvation.
          m.timer=setTimeout(poll,reply.frames.length?35:50);
        }catch(e){stop();setStatus('Монитор остановлен: '+e.message);}
      });
    };
    poll();
  };
  return <div className="space-y-2 rounded-xl border border-current/10 p-3">
    <strong className="text-sm">{mode==='mix'?'Музыка + голос · изолированный микс':'Непрерывный тест PCM'} · только наушники</strong>
    <p className="text-xs opacity-70">Прослушивание реального входа RØDECaster Duo с сервера. Не подключать USB-возврат к отправляемому миксу.</p>
    <button type="button" disabled={!active} onClick={enabled?stop:start}
      className="rounded-lg border border-current/20 px-3 py-2 text-sm disabled:opacity-50">
      {enabled?'Остановить монитор':mode==='mix'?'Слушать тестовый микс':'Слушать приватный PCM'}
    </button>
    <p role="status" className="text-xs opacity-70">{status}</p>
  </div>;
}
