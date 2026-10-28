import { useEffect, useState } from 'react';
import { api } from '../../../api/client.js';
export default function MchsOperatorReviews({ token, events = [], selectedEvent, onOpenEvent }) {
  const [reviews, setReviews] = useState({});
  const [notes, setNotes] = useState({});
  const [saving, setSaving] = useState('');
  const [filter, setFilter] = useState('pending');
  const [expanded, setExpanded] = useState(null);
  const [page, setPage] = useState(1);
  const [success, setSuccess] = useState('');
  useEffect(() => { if(selectedEvent) {setFilter('all');setSearch(selectedEvent);setPage(1);setExpanded(selectedEvent);} },[selectedEvent]);
  const [search, setSearch] = useState('');
  const pendingCount = events.filter(e => !reviews[e.id]).length;
  const reviewedCount = events.length - pendingCount;
  const visible = [...events].sort((a,b)=>new Date(b.receivedAt||0)-new Date(a.receivedAt||0)).filter(event => (filter==='all'||(filter==='pending'?!reviews[event.id]:Boolean(reviews[event.id]))) && [event.title,event.body,event.id].some(s=>String(s||'').toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru'))));
  const [error, setError] = useState('');
  useEffect(() => { let live = true;
    api('/safety/operator-reviews', { token }).then(v => { if (live) setReviews(v.reviews || {}); })
      .catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [token]);
  const record = async (eventId, decision) => {
    const note = (notes[eventId] || '').trim();
    if (note.length < 3) { setError('Укажите причину или результат проверки (минимум 3 символа)'); return; }
    setError(''); setSaving(eventId); setSuccess('');
    try {
      const result = await api('/safety/operator-reviews/' + encodeURIComponent(eventId), {
        token, method: 'PUT', body: { decision, note },
      });
      setReviews(prev => ({ ...prev, [eventId]: result.review }));
      setSuccess('Решение сохранено в журнале. Радиовещание не запущено.');
      setExpanded(null);
    } catch (e) { setError(e.message); } finally { setSaving(''); }
  };
  return <section className="rounded-2xl border border-slate-200 p-4 dark:border-white/10 md:p-5 space-y-3">
    <h3 className="text-lg font-semibold">Ручная проверка наблюдений</h3>
    <p className="text-sm opacity-70">Подтвердите ознакомление или отклоните запись с причиной. Это журнал решений, а не подтверждение официальной угрозы. Ни одна кнопка не запускает аудио.</p>
    {success && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{success}</p>}
    {error && <p role="alert" className="text-red-600 dark:text-red-300 text-sm">{error}</p>}
    <div className="grid grid-cols-3 gap-2 text-center">{[["Ожидают",pendingCount],["Рассмотрены",reviewedCount],["Загружено",events.length]].map(([name,count])=><div key={name} className="rounded-xl border border-slate-200 dark:border-white/15 p-3"><strong className="block text-xl">{count}</strong><span className="text-xs opacity-70">{name}</span></div>)}</div>
    <div className="flex flex-col sm:flex-row gap-2">
      <input aria-label="Поиск наблюдений" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Поиск по тексту или ID"
        className="min-w-0 flex-1 rounded-xl border border-slate-300 dark:border-white/20 bg-transparent px-3 py-2 text-sm" />
      <select aria-label="Фильтр ручных проверок" value={filter} onChange={e=>{setFilter(e.target.value);setPage(1);}}
        className="rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
        <option value="pending">Ожидают решения</option><option value="reviewed">Рассмотрены</option><option value="all">Все</option>
      </select>
    </div>
    <p className="text-xs opacity-60">Фильтр применяется только к загруженным событиям. Показано: {Math.min(20,Math.max(0,visible.length-(page-1)*20))} из {visible.length} подходящих. Счётчики относятся только к загруженным сообщениям.</p>
    {visible.slice((page-1)*20, page*20).map(event => <article key={event.id} className={`rounded-xl border p-3 space-y-2 ${selectedEvent===event.id ? "border-violet-500 ring-1 ring-violet-400" : "border-slate-200 dark:border-white/10"}`}>
      <div className="text-xs opacity-60">{new Date(event.receivedAt).toLocaleString('ru-RU')}</div>
      <h4 className="font-semibold break-words">{event.title}</h4>
      {onOpenEvent && <button type="button" onClick={()=>onOpenEvent(event.id)} className="text-sm underline underline-offset-2">Открыть сообщение в журнале</button>}
      <p className="text-sm opacity-70 line-clamp-2 break-words">{event.body}</p>
      {reviews[event.id] ? <p className="text-sm">Решение: <strong>{reviews[event.id].decision === 'ACKNOWLEDGED' ? 'Ознакомлен' : 'Отклонено'}</strong> · {reviews[event.id].note} · {new Date(reviews[event.id].reviewedAt).toLocaleString('ru-RU')}</p> :
        <><button type="button" className="rounded-lg border border-violet-300 dark:border-violet-500 px-3 py-2 text-sm" onClick={()=>setExpanded(expanded===event.id?null:event.id)}>{expanded===event.id ? "Свернуть проверку" : "Рассмотреть сообщение"}</button>
        {expanded===event.id && <><label className="block text-sm">Примечание ответственного
          <input className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent p-2 dark:border-white/20" maxLength={500} value={notes[event.id] || ''} onChange={e => setNotes(prev => ({ ...prev, [event.id]: e.target.value }))} placeholder="Результат проверки или причина отклонения" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button disabled={saving === event.id} type="button" onClick={() => record(event.id, 'ACKNOWLEDGED')} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50">Отметить ознакомление</button>
          <button disabled={saving === event.id} type="button" onClick={() => record(event.id, 'DISMISSED')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-white/20 disabled:opacity-50">Отклонить запись</button>
        </div></>}</>}
    </article>)}
    {visible.length>20 && <div className="flex items-center justify-between gap-2 text-sm"><button type="button" disabled={page===1} onClick={()=>setPage(x=>Math.max(1,x-1))} className="rounded-lg border border-slate-300 dark:border-white/20 px-3 py-2 disabled:opacity-40">Назад</button><span>Страница {page} из {Math.ceil(visible.length/20)}</span><button type="button" disabled={page>=Math.ceil(visible.length/20)} onClick={()=>setPage(x=>x+1)} className="rounded-lg border border-slate-300 dark:border-white/20 px-3 py-2 disabled:opacity-40">Вперёд</button></div>}
    {!events.length && <p className="text-sm opacity-60">Наблюдений пока нет.</p>}
    {events.length>0 && visible.length===0 && <p className="text-sm opacity-60">По выбранным фильтрам записей нет.</p>}
  </section>;
}
