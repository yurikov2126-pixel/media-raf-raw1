import { useEffect, useState } from 'react';
import { api } from '../../../api/client.js';

const STATUS = { active: 'Идёт сейчас', upcoming: 'Скоро', finished: 'Завершён' };
export default function SeasonsPanel({ token }) {
  const [seasons, setSeasons] = useState([]);
  const [selected, setSelected] = useState('');
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    api('/gamification/seasons', { token }).then(r => {
      if (!live) return;
      setSeasons(r.seasons || []);
      setSelected((r.seasons || []).find(s => s.status === 'active')?.slug || r.seasons?.[0]?.slug || '');
    }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [token]);
  useEffect(() => {
    if (!selected) return;
    let live = true;
    api('/gamification/seasons/' + encodeURIComponent(selected) + '/leaderboard', { token })
      .then(r => { if (live) setItems(r.items || []); })
      .catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [selected, token]);
  return <section className="card p-4 space-y-4">
    <div><h3 className="font-bold text-lg">🏆 Сезоны медиацентра</h3><p className="text-sm text-white/60">Сезонный рейтинг учитывает XP за период. Общий опыт и уровни не обнуляются.</p></div>
    {error && <p role="alert" className="text-pink text-sm">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-3">{seasons.map(s => <button type="button" key={s.id} onClick={() => setSelected(s.slug)} aria-pressed={selected === s.slug} className={'p-3 rounded-xl border text-left ' + (selected === s.slug ? 'border-violet bg-violet/10' : 'border-white/15')}>
      <strong className="block">{s.title}</strong><span className="text-xs opacity-70">{STATUS[s.status]} · {new Date(s.startsAt).toLocaleDateString('ru-RU')} — {new Date(s.endsAt).toLocaleDateString('ru-RU')}</span><p className="text-xs mt-1 opacity-70">{s.description}</p>
    </button>)}</div>
    {selected && <div className="space-y-2"><strong>Рейтинг сезона</strong>{items.length === 0 ? <p className="text-sm opacity-60">Пока нет заработанных XP за этот период.</p> : items.slice(0,10).map((u,i) => <div key={u.id} className="flex justify-between gap-2 text-sm border-b border-white/10 py-2"><span>{i+1}. {u.fullName}</span><strong>{u.xp} XP</strong></div>)}</div>}
  </section>;
}
