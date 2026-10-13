import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../api/client.js';

export default function EditorialTeam({ token }) {
  const [data, setData] = useState({ members: [], positions: [] });
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => setData(await api('/admin/editorial-team', { token }));
  useEffect(() => { load().catch(e => setError(e.message)); }, [token]);
  const members = useMemo(() => data.members.filter(m =>
    [m.user.fullName, m.user.username, m.user.role, m.position || ''].join(' ').toLowerCase().includes(query.trim().toLowerCase())
  ), [data.members, query]);

  const update = async (member, patch) => {
    const next = { memberType: member.memberType, position: member.position, ...patch };
    setSaving(member.userId); setError(''); setNotice('');
    try {
      await api('/admin/editorial-team/' + encodeURIComponent(member.userId), {
        method: 'PUT', token, body: next,
      });
      await load(); setNotice('Изменения сохранены');
    } catch (e) { setError(e.message); } finally { setSaving(''); }
  };

  return <section className="space-y-5 text-slate-900 dark:text-slate-100">
    <header><h2 className="text-2xl font-bold">Команда редакции</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Здесь автоматически отображаются все зарегистрированные пользователи платформы.
        Назначайте должности по умолчанию — при создании проекта их можно изменить отдельно.
      </p>
    </header>
    <div className="rounded-xl border border-violet-300 bg-violet-50 p-4 text-sm text-violet-950 dark:border-violet-400/40 dark:bg-violet-400/10 dark:text-violet-100">
      Редакционная должность отображается в профиле, но не меняет системную роль и права доступа.
      Должность в отдельном проекте может отличаться.
    </div>
    {error && <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
    {notice && <p role="status" className="text-emerald-700 dark:text-emerald-300">{notice}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <strong>Все пользователи · {members.length}</strong>
      <input aria-label="Поиск участника" className="w-full max-w-sm rounded-xl border border-slate-400 bg-white px-3 py-3 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white" placeholder="Имя, логин или должность" value={query} onChange={e => setQuery(e.target.value)} />
    </div>
    <div className="grid gap-3 lg:grid-cols-2">
      {members.map(member => <article key={member.userId} className="rounded-2xl border border-slate-300 bg-white p-4 dark:border-slate-600 dark:bg-slate-800">
        <h3 className="font-bold">{member.user.fullName}</h3>
        <p className="mb-3 text-xs text-slate-600 dark:text-slate-300">@{member.user.username} · {member.user.role}{member.user.isBanned ? ' · заблокирован' : ''}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Статус в редакции
            <select className="mt-1 w-full rounded-lg border border-slate-400 bg-white p-3 text-slate-900 dark:border-slate-500 dark:bg-slate-950 dark:text-white" disabled={saving === member.userId} value={member.memberType} onChange={e => update(member, { memberType: e.target.value })}>
              <option value="STUDENT">Студент</option><option value="MENTOR">Руководитель</option>
            </select>
          </label>
          <label className="text-sm font-medium">Должность команды
            <select className="mt-1 w-full rounded-lg border border-slate-400 bg-white p-3 text-slate-900 dark:border-slate-500 dark:bg-slate-950 dark:text-white" disabled={saving === member.userId} value={member.position || ''} onChange={e => update(member, { position: e.target.value || null })}>
              <option value="">Не назначена</option>
              {data.positions.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
            </select>
          </label>
        </div>
      </article>)}
    </div>
    {!members.length && <p className="text-sm opacity-75">Пользователи не найдены.</p>}
  </section>;
}
