import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../api/client.js';

const field = 'w-full rounded-xl border border-slate-400 bg-white px-3 py-2 text-slate-950 dark:border-slate-500 dark:bg-slate-900 dark:text-white';
export default function EditorialTeam({ token }) {
  const [data, setData] = useState({ members: [], positions: [] });
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState('');
  const [edit, setEdit] = useState(null);
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const reload = async () => setData(await api('/admin/editorial-team', { token }));
  useEffect(() => { reload().catch(e => setError(e.message)); }, [token]);
  const filtered = useMemo(() => data.members.filter(m =>
    [m.user.fullName, m.user.username, m.user.role, m.position].join(' ').toLowerCase().includes(query.toLowerCase())
  ), [data.members, query]);
  const execute = async (fn, message) => {
    setSaving('busy'); setError(''); setNotice('');
    try { await fn(); await reload(); setNotice(message); setEdit(null); setAdding(false); setCode(''); setLabel(''); }
    catch (e) { setError(e.message); } finally { setSaving(''); }
  };
  const saveMember = (userId, position) => execute(
    () => api('/admin/editorial-team/' + encodeURIComponent(userId), { token, method: 'PUT', body: { position: position || null } }),
    'Должность обновлена'
  );
  const savePosition = () => execute(
    () => api('/admin/editorial-positions' + (edit ? '/' + encodeURIComponent(edit) : ''), {
      token, method: edit ? 'PATCH' : 'POST', body: edit ? { label } : { code, label }
    }), 'Справочник должностей обновлён'
  );
  const removePosition = p => {
    if (!window.confirm('Удалить должность «' + p.label + '»?')) return;
    execute(() => api('/admin/editorial-positions/' + encodeURIComponent(p.code), { token, method: 'DELETE' }), 'Должность удалена');
  };
  return <div className="space-y-5 text-slate-950 dark:text-slate-100">
    <header><h2 className="text-2xl font-bold">Команда редакции</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Все зарегистрированные участники платформы. Назначьте каждому редакционную должность по умолчанию.</p></header>
    {error && <p role="alert" className="rounded-xl bg-red-100 p-3 text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-green-100 p-3 text-green-800 dark:bg-green-950 dark:text-green-200">{notice}</p>}
    <section className="rounded-2xl border border-slate-300 bg-white p-4 dark:border-slate-600 dark:bg-slate-800">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Редактор должностей · {data.positions.length}</h3>
        <button className="btn-primary" onClick={() => { setAdding(true); setEdit(null); setLabel(''); setCode(''); }}>+ Новая должность</button></div>
      <div className="grid gap-2 sm:grid-cols-2">{data.positions.map(p => <div key={p.code} className="flex items-center justify-between gap-2 rounded-xl border border-slate-300 p-3 dark:border-slate-600"><div className="min-w-0"><strong className="block break-words text-sm">{p.label}</strong><span className="text-xs opacity-65">{p.code}</span></div><div className="flex gap-1"><button className="btn-ghost" onClick={() => { setEdit(p.code); setAdding(false); setLabel(p.label); }}>✎</button><button className="btn-ghost" disabled={!!saving} onClick={() => removePosition(p)}>✕</button></div></div>)}</div>
      {(adding || edit) && <div className="mt-4 grid gap-3 rounded-xl border border-violet-400 p-3 sm:grid-cols-[1fr_1fr_auto]" role="group" aria-label="Редактор должности">
        {!edit && <label className="text-sm">Код<input className={field} value={code} maxLength={40} placeholder="PHOTOGRAPHER" onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g,''))}/></label>}
        <label className="text-sm">Название<input className={field} value={label} maxLength={80} placeholder="Фотограф" onChange={e => setLabel(e.target.value)}/></label>
        <div className="flex items-end gap-2"><button className="btn-primary" disabled={!!saving || !label.trim() || (!edit && !code)} onClick={savePosition}>Сохранить</button><button className="btn-ghost" onClick={() => { setEdit(null); setAdding(false); }}>Отмена</button></div>
      </div>}
    </section>
    <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">Состав редакции · {filtered.length}</h3><input className={field + ' max-w-xs'} value={query} onChange={e => setQuery(e.target.value)} placeholder="Найти человека"/></div>
      <div className="grid gap-3 md:grid-cols-2">{filtered.map(m => <article key={m.userId} className="rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-600 dark:bg-slate-800">
        <h4 className="font-semibold">{m.user.fullName}</h4><p className="mb-3 text-xs text-slate-600 dark:text-slate-300">@{m.user.username} · {m.user.role}</p>
        <label className="block text-sm">Должность в редакции
          <select key={m.userId + ':' + (m.position || '')} className={field + ' mt-1'} value={m.position || ''} disabled={!!saving} onChange={e => saveMember(m.userId, e.target.value)}>
            <option value="">Не назначена</option>{data.positions.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
          </select>
        </label>
      </article>)}</div>
    </section>
    <p className="text-xs opacity-75">Редакционная должность отображается в профиле. В конкретном проекте её можно изменить, не затрагивая должность по умолчанию и системные права доступа.</p>
  </div>;
}
