import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../api/client.js';

const metrics=[['messages','Полученные сообщения'],['analyzed','Анализ очереди'],['incidents','Новые неисправности'],['reviews','Решения оператора']];
const fmtMs=value=>value==null?'Нет данных':value<60000?Math.round(value/1000)+' сек':(value/60000).toFixed(1)+' мин';

export default function MchsAnalytics({token}) {
 const [days,setDays]=useState(30);
 const [data,setData]=useState(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const refresh=useCallback(async()=>{
   setLoading(true);setError('');
   try{setData(await api('/safety/analytics?days='+days,{token}));}
   catch(e){setData(null);setError(e.message||'Не удалось загрузить аналитику');}
   finally{setLoading(false);}
 },[days,token]);
 useEffect(()=>{void refresh();},[refresh]);
 const max=Math.max(1,...(data?.series||[]).map(v=>v.messages));
 return <section className="mchs-panel rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 p-4 sm:p-5 space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h3 className="font-semibold text-lg">Аналитика диагностики МЧС</h3><p className="text-sm text-slate-600 dark:text-slate-300">Сохранённые наблюдения и технические действия, не статистика официальных тревог.</p></div>
   <div className="flex gap-2"><select aria-label="Период аналитики" value={days} onChange={e=>setDays(Number(e.target.value))} className="rounded-xl border border-slate-300 dark:border-white/20 px-3 py-2"><option value={7}>7 дней</option><option value={30}>30 дней</option><option value={90}>90 дней</option></select>
   <button type="button" onClick={()=>void refresh()} disabled={loading} className="rounded-xl border border-slate-300 dark:border-white/20 px-3 py-2 disabled:opacity-50">{loading?'Загрузка…':'Обновить'}</button></div>
  </div>
  {error&&<p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
  {data&&<>
   <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
    {[['Получено сообщений',data.totals.messages],['Проанализировано',data.totals.analyzed],['Ожидают анализа',data.totals.pending],['Технические неисправности',data.totals.incidents],['Решения оператора',data.totals.reviews],['Среднее время анализа',fmtMs(data.totals.averageAnalysisMs)]].map(([label,value])=><div key={label} className="rounded-xl border border-slate-200 dark:border-white/15 p-3"><span className="block text-xs text-slate-600 dark:text-slate-300">{label}</span><strong className="block mt-1 text-xl">{value}</strong></div>)}
   </div>
   <div className="rounded-xl border border-slate-200 dark:border-white/15 p-3 space-y-3">
    <h4 className="font-semibold">Сообщения по дням</h4>
    <div className="flex gap-1 items-end h-44 overflow-hidden" role="img" aria-label="Столбчатый график числа сохранённых сообщений за выбранный период">
     {data.series.map(row=><div key={row.date} className="flex-1 min-w-0 rounded-t bg-violet-500/80 dark:bg-violet-400/80 hover:bg-violet-600" style={{height:Math.max(3,row.messages/max*100)+'%'}} title={row.date+': '+row.messages} />)}
    </div>
    <p className="text-xs text-slate-600 dark:text-slate-300">Период: {data.series[0]?.date} — {data.series[data.series.length-1]?.date}. Наведи указатель на столбец для количества. Ноль означает отсутствие записей в базе, не отсутствие оповещений.</p>
   </div>
   <details className="rounded-xl border border-slate-200 dark:border-white/15 p-3">
    <summary className="font-semibold cursor-pointer">Таблица статистики по дням</summary>
    <div className="overflow-x-auto mt-3"><table className="w-full text-sm text-left"><thead><tr>{['Дата',...metrics.map(x=>x[1])].map(x=><th key={x} className="p-2 border-b border-slate-200 dark:border-white/15">{x}</th>)}</tr></thead><tbody>{data.series.map(row=><tr key={row.date}><td className="p-2 border-b border-slate-200 dark:border-white/10 whitespace-nowrap">{row.date}</td>{metrics.map(([key])=><td key={key} className="p-2 border-b border-slate-200 dark:border-white/10">{row[key]}</td>)}</tr>)}</tbody></table></div>
   </details>
   {data.limits?.truncated&&<p role="alert" className="text-sm text-amber-800 dark:text-amber-200">Достигнут лимит выборки 10 000 записей — показатели могут быть неполными.</p>}
   <p className="text-xs text-slate-600 dark:text-slate-300">Только диагностические данные. Доставка push не может быть оценена без независимого источника ожидаемых сообщений. Отметки анализа и решения оператора не подтверждают подлинность сообщения. Радиоэфир отключён.</p>
  </>}
 </section>;
}
