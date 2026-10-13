import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../api/client.js';

const empty = { code: '', name: '', description: '', permissions: [] };
export default function Roles({ token }) {
  const [data, setData] = useState({ roles: [], permissions: [] });
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [matrixOpen, setMatrixOpen] = useState(true);
  const reload = async () => { const next = await api('/admin/roles', { token }); setData(next); };
  useEffect(() => { reload().catch(e => setError(e.message)); }, [token]);
  const groups = useMemo(() => Object.groupBy ? Object.groupBy(data.permissions, p => p.group) :
    data.permissions.reduce((a, p) => ((a[p.group] ||= []).push(p), a), {}), [data.permissions]);
  const edit = role => { setError(''); setNotice(''); setDraft(role ? { ...role, permissions: [...role.permissions] } : { ...empty }); };
  const toggleGroup = (items) => {
    const keys = items.map(p => p.id);
    setDraft(prev => {
      const selected = new Set(prev.permissions);
      const allSelected = keys.every(key => selected.has(key));
      keys.forEach(key => allSelected ? selected.delete(key) : selected.add(key));
      return { ...prev, permissions: [...selected] };
    });
  };
  const isEditing = Boolean(draft && data.roles.some(r => r.code === draft.code));
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
      Важно: переход на единые права выполняется поэтапно. Теперь права на создание проектов, библиотеку редакции, проверку практик и домашних заданий, а также разблокировку уроков проверяются сервером. Для практик сохраняется ограничение на назначенного руководителя. Остальные проверки ролей ещё работают по старой модели. Роль ADMIN всегда имеет полный доступ.
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
    <section className="rounded-2xl border border-slate-300 bg-white p-4 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="text-lg font-bold">Матрица прав</h3><p className="text-sm opacity-75">Сравнение действующих разрешений всех ролей</p></div>
        <button className="btn-ghost" type="button" aria-expanded={matrixOpen} onClick={() => setMatrixOpen(v => !v)}>{matrixOpen ? 'Скрыть' : 'Показать'}</button>
      </div>
      {matrixOpen && <div className="overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-600" role="region" aria-label="Матрица разрешений" tabIndex={0}>
        <table className="w-full min-w-[680px] border-collapse text-left text-sm">
          <thead><tr className="bg-slate-100 dark:bg-slate-900"><th scope="col" className="sticky left-0 z-10 min-w-[220px] bg-slate-100 p-3 dark:bg-slate-900">Разрешение</th>
          {data.roles.map(role => <th scope="col" key={role.code} className="min-w-[110px] p-3 text-center"><span className="block">{role.name}</span><span className="text-xs font-normal opacity-70">{role.code}</span></th>)}</tr></thead>
          <tbody>{data.permissions.map(p => <tr key={p.id} className="border-t border-slate-200 dark:border-slate-700">
            <th scope="row" className="sticky left-0 bg-white p-3 font-medium dark:bg-slate-800"><span className="block text-xs opacity-70">{p.group}</span>{p.label}</th>
            {data.roles.map(role => {
              const enabled = role.permissions.includes('*') || role.permissions.includes(p.id);
              return <td key={role.code} className="p-3 text-center"><span title={enabled ? 'Разрешено' : 'Запрещено'} aria-label={enabled ? 'Разрешено' : 'Запрещено'} className={enabled ? 'font-bold text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}>{enabled ? '✓' : '—'}</span></td>;
            })}</tr>)}</tbody>
        </table>
      </div>}
      <p className="mt-3 text-xs opacity-75">Матрица показывает только разрешения, подключённые к RBAC. Отдельные роли внутри проектов не отражаются.</p>
    </section>
    {draft && <div className="mrr-role-modal fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-3 sm:p-6" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setDraft(null); }}>
      <div role="dialog" aria-modal="true" aria-label="Редактирование роли" className="mrr-role-dialog flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border shadow-2xl">
        <div className="mrr-role-dialog__heading flex items-start justify-between gap-3 px-5 py-4">
          <div><h3 className="text-xl font-bold">{isEditing ? 'Редактировать роль' : 'Новая роль'}</h3><p className="mt-1 text-sm opacity-75">Настройте роль и выберите доступные действия</p></div>
          <button type="button" className="mrr-role-close shrink-0" aria-label="Закрыть" onClick={() => setDraft(null)}>✕</button>
        </div>
        <div className="mrr-role-dialog__content space-y-4 overflow-y-auto px-5 py-4">
        <label className="block text-sm font-semibold">Код роли<input className="mrr-role-field mt-1 block w-full rounded-xl border px-3 py-3 text-base" disabled={data.roles.some(r => r.code === draft.code)} maxLength={32} value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })} placeholder="PHOTO_EDITOR" /></label>
        <label className="block text-sm font-semibold">Название<input className="mrr-role-field mt-1 block w-full rounded-xl border px-3 py-3 text-base" maxLength={60} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
        <label className="block text-sm font-semibold">Описание<textarea className="mrr-role-field mt-1 block w-full rounded-xl border px-3 py-3 text-base" maxLength={240} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
        <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">Разрешённые действия</h4><span className="mrr-role-count rounded-full px-3 py-1 text-xs font-semibold">{draft.permissions.length} выбрано</span></div>
        {Object.entries(groups).map(([group, permissions]) => <fieldset key={group} className="mrr-role-group rounded-xl border p-3">
          <legend className="px-2 font-semibold">{group}</legend>
          <div className="mb-2 flex justify-end"><button type="button" className="mrr-role-group-toggle rounded-lg px-2 py-1 text-xs font-semibold" onClick={() => toggleGroup(permissions)}>{permissions.every(p => draft.permissions.includes(p.id)) ? 'Снять все' : 'Выбрать все'}</button></div>
          {permissions.map(p => <label key={p.id} className="mrr-role-option flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm"><input className="mrr-role-checkbox h-5 w-5 shrink-0" type="checkbox" checked={draft.permissions.includes(p.id)} onChange={e => setDraft(prev => ({ ...prev, permissions: e.target.checked ? [...prev.permissions, p.id] : prev.permissions.filter(x => x !== p.id) }))} /><span>{p.label}</span></label>)}
        </fieldset>)}
        {error && <p role="alert" className="mb-3 text-red-600 dark:text-red-300">{error}</p>}
        </div>
        <div className="mrr-role-dialog__footer flex flex-wrap justify-end gap-3 px-5 py-4"><button className="mrr-role-cancel rounded-xl px-5 py-3 font-semibold" onClick={() => setDraft(null)}>Отмена</button><button className="btn-primary" disabled={busy || !draft.name.trim() || !draft.code.trim()} onClick={save}>{busy ? 'Сохраняем…' : 'Сохранить'}</button></div>
      </div>
    </div>}
  </section>;
}
