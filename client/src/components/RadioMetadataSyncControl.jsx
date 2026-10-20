export default function RadioMetadataSyncControl({config,setConfig,delay,automaticMeasured,compact=false}){
 const selectClass='rounded-lg border border-current/25 bg-slate-900 px-2 py-1.5 text-sm text-white';
 return <div className={compact?'flex flex-wrap items-center gap-2 text-xs':'rounded-xl border border-current/20 p-3 text-sm'}>
  <label className="flex flex-wrap items-center gap-2">
   <span className="font-semibold">Синхронизация трека</span>
   <select aria-label="Режим синхронизации метаданных" className={selectClass}
    value={config.mode} onChange={e=>setConfig(c=>({...c,mode:e.target.value}))}>
    <option value="auto">Авто</option><option value="manual">Вручную</option><option value="off">Без коррекции</option>
   </select>
  </label>
  {config.mode!=='off'&&<label className="flex items-center gap-2">
   <span>{config.mode==='auto'?'Резервная поправка':'Поправка'}</span>
   <input aria-label="Задержка метаданных в секундах" type="number" min="0" max="30" step="1"
    className="w-16 rounded-lg border border-current/25 bg-slate-900 px-2 py-1.5 text-white"
    value={config.manualDelay} onChange={e=>setConfig(c=>({...c,manualDelay:Math.min(30,Math.max(0,Number(e.target.value)||0))}))}/>
   <span>с</span>
  </label>}
  <span className="opacity-75">Отображение: −{delay.toFixed(1)} с{config.mode==='auto'&&!automaticMeasured?' · оценка недоступна, резервная поправка':''}</span>
 </div>;
}
