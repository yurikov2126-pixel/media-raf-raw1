import { useEffect, useState } from 'react';
import { api } from '../../../api/client.js';
export default function MchsOperatorReviews({ token, events = [] }) {
  const [reviews, setReviews] = useState({});
  const [notes, setNotes] = useState({});
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { let live = true;
    api('/safety/operator-reviews', { token }).then(v => { if (live) setReviews(v.reviews || {}); })
      .catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [token]);
  const record = async (eventId, decision) => {
    const note = (notes[eventId] || '').trim();
    if (note.length < 3) { setError('Укажите причину или результат проверки (минимум 3 символа)'); return; }
    setError(''); setSaving(eventId);
    try {
      const result = await api('/safety/operator-reviews/' + encodeURIComponent(eventId), {
        token, method: 'PUT', body: { decision, note },
      });
      setReviews(prev => ({ ...prev, [eventId]: result.review }));
    } catch (e) { setError(e.message); } finally { setSaving(''); }
  };
  return <section className="rounded-2xl border border-slate-200 p-4 dark:border-white/10 md:p-5 space-y-3">
    <h3 className="text-lg font-semibold">Ручная проверка наблюдений</h3>
    <p className="text-sm opacity-70">Подтвердите ознакомление или отклоните запись с причиной. Это журнал решений, а не подтверждение официальной угрозы. Ни одна кнопка не запускает аудио.</p>
    {error && <p role="alert" className="text-red-600 dark:text-red-300 text-sm">{error}</p>}
    {events.slice(0, 20).map(event => <article key={event.id} className="rounded-xl border border-slate-200 p-3 dark:border-white/10 space-y-2">
      <div className="text-xs opacity-60">{new Date(event.receivedAt).toLocaleString('ru-RU')}</div>
      <h4 className="font-semibold break-words">{event.title}</h4>
      <p className="text-sm opacity-70 line-clamp-2 break-words">{event.body}</p>
      {reviews[event.id] ? <p className="text-sm">Решение: <strong>{reviews[event.id].decision === 'ACKNOWLEDGED' ? 'Ознакомлен' : 'Отклонено'}</strong> · {reviews[event.id].note} · {new Date(reviews[event.id].reviewedAt).toLocaleString('ru-RU')}</p> :
        <><label className="block text-sm">Примечание ответственного
          <input className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent p-2 dark:border-white/20" maxLength={500} value={notes[event.id] || ''} onChange={e => setNotes(prev => ({ ...prev, [event.id]: e.target.value }))} placeholder="Результат проверки или причина отклонения" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button disabled={saving === event.id} type="button" onClick={() => record(event.id, 'ACKNOWLEDGED')} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50">Отметить ознакомление</button>
          <button disabled={saving === event.id} type="button" onClick={() => record(event.id, 'DISMISSED')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-white/20 disabled:opacity-50">Отклонить запись</button>
        </div></>}
    </article>)}
    {!events.length && <p className="text-sm opacity-60">Наблюдений пока нет.</p>}
  </section>;
}
