import { useEffect, useRef, useState } from 'react';

const LEVEL_WINDOW = 1024;
const averagePeak = data => {
  let sum = 0, peak = 0;
  for(let i = 0; i < data.length; i++){
    const sample = data[i];
    sum += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  return { rms: Math.sqrt(sum / data.length), peak };
};

function StereoLevels({ stream }) {
  const [levels, setLevels] = useState([{rms:0,peak:0},{rms:0,peak:0}]);
  const [channels,setChannels] = useState(0);
  useEffect(() => {
    if(!stream || typeof window === 'undefined')return;
    const Context = window.AudioContext || window.webkitAudioContext;
    if(!Context)return;
    const context = new Context();
    const source = context.createMediaStreamSource(stream);
    const splitter = context.createChannelSplitter(2);
    const analysers = [context.createAnalyser(),context.createAnalyser()];
    const buffers = analysers.map(() => new Float32Array(LEVEL_WINDOW));
    analysers.forEach((analyser,index)=>{
      analyser.fftSize = LEVEL_WINDOW;
      analyser.smoothingTimeConstant = 0.5;
      splitter.connect(analyser,index);
    });
    source.connect(splitter);
    setChannels(stream.getAudioTracks()[0]?.getSettings?.().channelCount || 1);
    let animationFrame = null,closed=false,lastUpdate=0;
    const draw = timestamp => {
      if(closed)return;
      if(timestamp-lastUpdate>80){
        analysers.forEach((analyser,index)=>analyser.getFloatTimeDomainData(buffers[index]));
        setLevels(buffers.map(averagePeak));
        lastUpdate=timestamp;
      }
      animationFrame=requestAnimationFrame(draw);
    };
    animationFrame=requestAnimationFrame(draw);
    return ()=>{
      closed=true;
      if(animationFrame!==null)cancelAnimationFrame(animationFrame);
      source.disconnect();splitter.disconnect();analysers.forEach(a=>a.disconnect());
      void context.close();
    };
  },[stream]);
  return <div className="space-y-2 rounded-xl border border-current/10 p-3">
    <div className="flex justify-between gap-2 text-xs opacity-75">
      <span>Входящий сигнал · {channels>=2?'стерео':'моно / определяется браузером'}</span>
      <span>Проверка до эфира</span>
    </div>
    {levels.map((level,index)=><div className="flex items-center gap-3 text-sm" key={index}>
      <span className="w-3">{index===0?'L':'R'}</span>
      <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10" role="meter"
        aria-label={index===0?'Левый канал':'Правый канал'} aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={Math.round(level.rms*100)}>
        <div className={`h-full rounded-full transition-[width] duration-75 ${level.peak>0.98?'bg-red-500':'bg-emerald-500'}`}
          style={{width:`${Math.min(100,Math.round(level.rms*100))}%`}}/>
      </div>
      <span className="w-14 text-right text-xs tabular-nums">{level.rms>0?(20*Math.log10(level.rms)).toFixed(1)+' dB':'−∞ dB'}</span>
    </div>)}
    <p className="text-xs opacity-60">Уровни считываются локально и не отправляются в аналитику. Красная шкала предупреждает о возможной перегрузке.</p>
  </div>;
}

export default function RadioUsbInputPanel({selectedId,onSelect,stream,locked=false}) {
  const [devices,setDevices]=useState([]);
  const [notice,setNotice]=useState('');
  const active = useRef(true);
  useEffect(()=>{
    active.current=true;
    let generation=0;
    const refresh=async()=>{
      const version=++generation;
      try{
        const all=await navigator.mediaDevices?.enumerateDevices?.() || [];
        if(active.current&&version===generation){
          setDevices(all.filter(item=>item.kind==='audioinput'));
          setNotice('');
        }
      }catch{if(active.current&&version===generation)setNotice('Нет доступа к списку микрофонов');}
    };
    void refresh();
    navigator.mediaDevices?.addEventListener?.('devicechange',refresh);
    return()=>{active.current=false;navigator.mediaDevices?.removeEventListener?.('devicechange',refresh);};
  },[stream]);
  const selectedAvailable=!selectedId||devices.some(d=>d.deviceId===selectedId);
  return <div className="space-y-3 rounded-xl border border-current/10 bg-black/5 p-3 dark:bg-white/5">
    <div className="flex items-center justify-between gap-2">
      <strong className="text-sm">Аудиовход студии</strong>
      <span className="text-xs opacity-65">macOS · Windows · USB Audio</span>
    </div>
    <label htmlFor="radio-usb-input" className="block text-xs opacity-80">Источник сигнала</label>
    <select id="radio-usb-input" value={selectedId} disabled={locked}
      onChange={event=>onSelect(event.target.value)}
      className="w-full rounded-lg border border-current/20 bg-transparent px-3 py-2 text-sm disabled:opacity-50">
      <option value="">Системный аудиовход по умолчанию</option>
      {devices.map((d,index)=><option key={d.deviceId||`unknown-${index}`} value={d.deviceId}>
        {d.label||`Аудиовход ${index+1} (имя появится после разрешения)`}
      </option>)}
    </select>
    {!selectedAvailable&&<p role="alert" className="text-sm text-amber-600 dark:text-amber-400">
      Ранее выбранное устройство недоступно. Выберите другой вход до запуска студии.
    </p>}
    {notice&&<p className="text-xs opacity-70">{notice}</p>}
    {locked&&<p className="text-xs opacity-65">Чтобы изменить источник, завершите текущую сессию ведущего.</p>}
    <p className="text-xs opacity-65">
      Для RØDECaster Duo выберите USB Main / Stereo Mix в зависимости от настроек микшера.
      Звук возврата с компьютера исключите из отправляемого микса (mix-minus), чтобы избежать эха.
    </p>
    {stream&&<StereoLevels stream={stream}/>}
  </div>;
}
