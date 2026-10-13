import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../api/client.js';

export default function EditorialTeam({ token }) {
  const [data, setData] = useState({ members: [], users: [], positions: [], types: [] });
  const [userId, setUserId] = useState('');
  const [memberType, setMemberType] = useState('STUDENT');
  const [position, setPosition] = useState('PHOTO_EDITOR');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const reload = async () => setData(await api('/admin/editorial-team', { token }));
  useEffect(() => { reload().catch(e => setError(e.message)); }, [token]);
  const selected = useMemo(() => data.users.find(u => u.id === userId), [data.users, userId]);
  const filtered = useMemo(() => data.members.filter(m =>
    [m.user.fullName, m.user.username, m.position, m.memberType].join(' ').toLowerCase().includes(query.toLowerCase())
  ), [data.members, query]);
  const save = async () => {
    if (!userId) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api('/admin/editorial-team/' + encodeURIComponent(userId), { token, method: 'PUT', body: { memberType, position } });
      await reload(); setNotice('Назначение сохранено');
    } catch(e) { setError(e.message); } finally { setBusy(false); }
  };
  const remove = async m => {
    if (!window.confirm('Исключить ' + m.user.fullName + ' из списка команды редакции?')) return;
    setBusy(true); setError('');
    try {
      await api('/admin/editorial-team/' + encodeURIComponent(m.userId), { token, method: 'DELETE' });
      await reload(); setNotice('Участник удалён из списка редакции');
    } catch(e) { setError(e.message); } finally { setBusy(false); }
  };
  const edit = m => { setUserId(m.userId); setMemberType(m.memberType); setPosition(m.position); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  return <div className="space-y-5 text-slate-900 dark:text-slate-100">
    <header><h2 className="text-2xl font-bold">Команда редакции</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Назначайте студентов и руководителей на редакционные должности независимо от глобальной роли и ролей в проектах.</p></header>
    <div className="rounded-xl border border-amber-400/50 bg-amber-100/70 p-4 text-sm text-amber-950 dark:bg-amber-400/10 dark:text-amber-100">
      Должность в редакции — организационное назначение, не новое разрешение API. Для возможности создавать проекты или управлять библиотекой назначьте нужные разрешения глобальной роли в разделе «Роли и права».
    </div>
    {error && <p role="alert" className="text-red-600 dark:text-red-300">{error}</p>}
    {notice && <p role="status" className="text-green-700 dark:text-green-300">{notice}</p>}
    <section className="rounded-2xl border border-slate-300 bg-white p-4 dark:border-slate-600 dark:bg-slate-800" aria-label="Назначение редакционной роли">
      <h3 className="mb-3 font-semibold">Назначить участника</h3>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm font-medium">Пользователь
          <select className="mt-1 block w-full rounded-xl border border-slate-400 bg-white p-3 text-slate-900 dark:border-slate-500 dark:bg-slate-950 dark:text-white" value={userId} onChange={e => setUserId(e.target.value)}>
            <option value="">Выберите участника</option>
            {data.users.map(u => <option key={u.id} value={u.id}>{u.fullName} (@{u.username})</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Статус в редакции
          <select className="mt-1 block w-full rounded-xl border border-slate-400 bg-white p-3 text-slate-900 dark:border-slate-500 dark:bg-slate-950 dark:text-white" value={memberType} onChange={e => setMemberType(e.target.value)}>
            <option value="STUDENT">Студент</option><option value="MENTOR">Руководитель</option>
          </select>
        </label>
        <label className="text-sm font-medium">Редакционная должность
          <select className="mt-1 block w-full rounded-xl border border-slate-400 bg-white p-3 text-slate-900 dark:border-slate-500 dark:bg-slate-950 dark:text-white" value={position} onChange={e => setPosition(e.target.value)}>
            {data.positions.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
          </select>
        </label>
      </div>
      {selected && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Глобальная роль: <strong>{selected.role}</strong>. Она не изменится.</p>}
      <button className="btn-primary mt-4" disabled={busy || !userId} onClick={save}>{busy ? 'Сохраняем…' : 'Сохранить назначение'}</button>
    </section>
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Состав редакции · {filtered.length}</h3>
        <input className="rounded-xl border border-slate-400 bg-white px-3 py-2 text-slate-900 dark:border-slate-500 dark:bg-slate-900 dark:text-white" value={query} onChange={e => setQuery(e.target.value)} placeholder="Поиск по команде" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map(m => <article key={m.id} className="rounded-2xl border border-slate-300 bg-white p-4 dark:border-slate-600 dark:bg-slate-800">
          <h4 className="font-bold">{m.user.fullName}</h4>
          <p className="text-xs text-slate-600 dark:text-slate-300">@{m.user.username} · Глобальная роль: {m.user.role}</p>
          <p className="mt-2 text-sm">{m.memberType === 'MENTOR' ? 'Руководитель' : 'Студент'} · {data.positions.find(p => p.code === m.position)?.label || m.position}</p>
          <div className="mt-3 flex gap-2"><button className="btn-ghost" onClick={() => edit(m)}>Изменить</button><button className="btn-ghost" disabled={busy} onClick={() => remove(m)}>Исключить</button></div>
        </article>)}
      </div>
      {!filtered.length && <p className="text-sm opacity-75">Участников пока нет.</p>}
    </section>
  </div>;
}
