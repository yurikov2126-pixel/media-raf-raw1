import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../api/client.js';

const empty = { code: '', name: '', description: '', permissions: [] };
export default function Roles({ token }) {
  const [data, setData] = useState({ roles: [], permissions: [] });
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const reload = async () => { const next = await api('/admin/roles', { token }); setData(next); };
  useEffect(() => { reload().catch(e => setError(e.message)); }, [token]);
  const groups = useMemo(() => Object.groupBy ? Object.groupBy(data.permissions, p => p.group) :
    data.permissions.reduce((a, p) => ((a[p.group] ||= []).push(p), a), {}), [data.permissions]);
  const edit = role => { setError(''); setNotice(''); setDraft(role ? { ...role, permissions: [...role.permissions] } : { ...empty }); };
  const save = async () => {
    setBusy(true); setError('');
    try {
      const body = { name: draft.name.trim(), description: draft.description.trim(), permissions: draft.permissions };
      if (!draft.builtin && data.roles.some(r => r.code === draft.code)) {
        await api('/admin/roles/' + encodeURIComponent(draft.code), { method: 'PATCH', token, body });
      } else {
        await api('/admin/roles', { method: 'POST', token, body: { ...body, code: draft.code.trim().toUpperCase() } });
      }
      setDraft(null); await reload(); setNotice('Роль сохранена');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const remove = async role => {
    if (!window.confirm('Удалить роль «' + role.name + '»? Пользователей нужно переназначить заранее.')) return;
    setBusy(true); setError('');
    try { await api('/admin/roles/' + encodeURIComponent(role.code), { method: 'DELETE', token }); await reload(); setNotice('Роль удалена'); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <section className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-bold">Роли и права</h2><p className="text-sm text-slate-600 dark:text-slate-300">Системные роли защищены. Новые роли получают только явно разрешённые действия.</p></div>
      <button className="btn-primary" onClick={() => edit(null)}>+ Создать роль</button>
    </header>
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100">
      Важно: переход на единые права выполняется поэтапно. Пока здесь редактируются только перечисленные ниже действия, а остальные ограничения STUDENT / MENTOR / ADMIN продолжают действовать в API. Роль ADMIN всегда имеет полный доступ.
    </div>
    {error && <p role="alert" className="text-red-600 dark:text-red-300">{error}</p>}
    {notice && <p role="status" className="text-green-700 dark:text-green-300">{notice}</p>}
    <div className="grid gap-3 md:grid-cols-2">
      {data.roles.map(r => <article key={r.code} className="rounded-2xl border border-slate-300 bg-white/80 p-5 text-slate-900 dark:border-white/15 dark:bg-white/5 dark:text-white">
        <div className="flex justify-between gap-3"><div><h3 className="font-bold text-lg">{r.name}</h3><p className="text-xs opacity-70">{r.code} · {r.count} пользователей</p></div><span className="text-xs opacity-70">{r.builtin ? 'Системная' : 'Своя роль'}</span></div>
        <p className="mt-2 text-sm opacity-80">{r.description || 'Без описания'}</p>
        <p className="mt-3 text-sm">{r.permissions.includes('*') ? 'Все права' : r.permissions.length ? r.permissions.map(p => data.permissions.find(x => x.id === p)?.label || p).join(' · ') : 'Без дополнительных прав'}</p>
        {!r.builtin && <div className="mt-4 flex gap-2"><button className="btn-ghost" onClick={() => edit(r)}>Изменить</button><button className="btn-ghost" disabled={busy || r.count > 0} onClick={() => remove(r)}>Удалить</button></div>}
      </article>)}
    </div>
    {draft && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setDraft(null); }}>
      <div role="dialog" aria-modal="true" aria-label="Редактирование роли" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-xl dark:bg-slate-900 dark:text-white">
        <h3 className="mb-4 text-xl font-bold">{data.roles.some(r => r.code === draft.code) ? 'Редактировать роль' : 'Новая роль'}</h3>
        <label className="block mb-3 text-sm">Код роли<input className="input mt-1 w-full" disabled={data.roles.some(r => r.code === draft.code)} maxLength={32} value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })} placeholder="PHOTO_EDITOR" /></label>
        <label className="block mb-3 text-sm">Название<input className="input mt-1 w-full" maxLength={60} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
        <label className="block mb-3 text-sm">Описание<textarea className="input mt-1 w-full" maxLength={240} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
        <h4 className="font-semibold mb-2">Разрешённые действия</h4>
        {Object.entries(groups).map(([group, permissions]) => <fieldset key={group} className="mb-3 rounded-lg border border-slate-300 p-3 dark:border-white/20"><legend className="px-1 font-medium">{group}</legend>
          {permissions.map(p => <label key={p.id} className="flex items-center gap-2 py-2 text-sm"><input type="checkbox" checked={draft.permissions.includes(p.id)} onChange={e => setDraft(prev => ({ ...prev, permissions: e.target.checked ? [...prev.permissions, p.id] : prev.permissions.filter(x => x !== p.id) }))} />{p.label}</label>)}
        </fieldset>)}
        {error && <p role="alert" className="mb-3 text-red-600 dark:text-red-300">{error}</p>}
        <div className="flex justify-end gap-3"><button className="btn-ghost" onClick={() => setDraft(null)}>Отмена</button><button className="btn-primary" disabled={busy || !draft.name.trim() || !draft.code.trim()} onClick={save}>{busy ? 'Сохраняем…' : 'Сохранить'}</button></div>
      </div>
    </div>}
  </section>;
}
