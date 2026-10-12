import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
const shareUrl = token => window.location.origin + '/share/editorial/' + token;
export default function EditorialShares() {
    const { token } = useAuth();
    const [files, setFiles] = useState([]);
    const [projects,setProjects]=useState([]);
    const [projectId,setProjectId]=useState('');
    const [createdLink,setCreatedLink]=useState('');
    const [shares, setShares] = useState([]);
    const [selected, setSelected] = useState([]);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [days, setDays] = useState('30');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [refresh, setRefresh] = useState(0);
    useEffect(() => { let active = true; Promise.all([api('/editorial/library/files', { token }), api('/editorial/library/shares', { token }), api('/editorial/library/folders', { token })]).then(([f,s,p]) => { if (active) { setFiles(f.files); setShares(s.shares); setProjects((p.folders||[]).filter(project=>project.files?.length)); } }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [token, refresh]);
    async function create(event) {
        event.preventDefault(); setBusy(true); setError('');
        try { await api('/editorial/library/shares', { token, method: 'POST', body: { title, description, fileIds: selected, expiresInDays: days === 'never' ? null : Number(days) } }); setTitle(''); setDescription(''); setSelected([]); setRefresh(n => n + 1); }
        catch (e) { setError(e.message); } finally { setBusy(false); }
    }
    async function shareProject(event) {
        event.preventDefault();if(!projectId||busy)return;
        setBusy(true);setError('');setCreatedLink('');
        try{const result=await api('/editorial/library/shares/quick',{token,method:'POST',body:{projectId}});setCreatedLink(shareUrl(result.share.token));setProjectId('');setRefresh(n=>n+1)}
        catch(e){setError(e.message)}finally{setBusy(false)}
    }
    async function revoke(id) {
        if (!window.confirm('Закрыть общий доступ по этой ссылке?')) return;
        try { await api('/editorial/library/shares/' + id + '/revoke', { token, method: 'POST' }); setRefresh(n => n + 1); } catch (e) { setError(e.message); }
    }
    return <div className="editorial-workspace-content space-y-5">
        <div><h2 className="text-xl font-semibold">Общий доступ</h2><p className="text-sm opacity-70">Создавайте ссылки для коллег. По ссылке можно просмотреть и скачать выбранные материалы без регистрации.</p></div>
        {error && <p role="alert" className="rounded-xl border border-red-500 p-3">{error}</p>}
        <form onSubmit={shareProject} className="space-y-3 rounded-2xl border border-violet-400/40 p-4">
            <h3 className="font-semibold">Поделиться целым проектом</h3>
            <p className="text-sm opacity-70">Создайте общую ссылку на все материалы проекта, включая проекты с более чем 200 файлами. Ссылка действует 30 дней; получателю не нужен аккаунт.</p>
            <label className="block text-sm">Проект<select value={projectId} onChange={e=>setProjectId(e.target.value)} className="mt-1 w-full rounded-lg border border-current/20 bg-transparent p-3"><option value="">Выберите проект</option>{projects.map(p=><option key={p.id} value={p.id}>{p.title} — {p.files.length} файлов</option>)}</select></label>
            <button disabled={!projectId||busy} className="rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy?'Создаём…':'Создать ссылку на проект'}</button>
            {createdLink&&<div role="status" className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/40 p-3 text-sm"><a className="break-all underline" href={createdLink} target="_blank" rel="noreferrer">{createdLink}</a><button type="button" className="rounded-lg border px-3 py-2" onClick={()=>navigator.clipboard.writeText(createdLink).catch(()=>setError('Не удалось скопировать ссылку'))}>Копировать</button></div>}
        </form>
        <form onSubmit={create} className="space-y-3 rounded-2xl border border-current/20 p-4">
            <h3 className="font-semibold">Новая подборка</h3>
            <label className="block text-sm">Название<input required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border bg-transparent p-3" placeholder="Фотографии с мероприятия" /></label>
            <label className="block text-sm">Описание<textarea maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} className="mt-1 w-full rounded-lg border bg-transparent p-3" rows={2} /></label>
            <fieldset className="space-y-2"><legend className="text-sm font-semibold">Файлы для передачи · выбрано {selected.length}</legend><div className="max-h-60 space-y-2 overflow-auto rounded-xl border p-2">{files.map(file => <label key={file.id} className="flex items-center gap-3 rounded-lg p-2 text-sm hover:bg-violet-500/10"><input type="checkbox" checked={selected.includes(file.id)} onChange={e => setSelected(v => e.target.checked ? [...v, file.id] : v.filter(id => id !== file.id))} /><span className="min-w-0 break-all">{file.name}</span></label>)}{!files.length && <p className="p-3 text-sm opacity-70">Сначала загрузите материалы в разделе «Файлы».</p>}</div></fieldset>
            <label className="block text-sm">Срок действия<select value={days} onChange={e => setDays(e.target.value)} className="mt-1 w-full rounded-lg border bg-transparent p-3"><option value="7">7 дней</option><option value="30">30 дней</option><option value="90">90 дней</option><option value="never">Без ограничения</option></select></label>
            <button disabled={busy || !selected.length || !title.trim()} className="rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white disabled:opacity-50">Создать ссылку</button>
        </form>
        <section className="space-y-3"><h3 className="font-semibold">Созданные ссылки</h3>{shares.map(share => { const expired = share.expiresAt && new Date(share.expiresAt) < new Date(); const disabled = !!share.revokedAt || expired; return <article key={share.id} className="rounded-xl border border-current/20 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">{share.title}</h4><span className="text-xs opacity-70">{share.revokedAt ? 'Отозвана' : expired ? 'Истекла' : 'Активна'}</span></div><p className="my-2 text-xs opacity-70">{share.fileIds.length} файлов · {share.expiresAt ? 'До ' + new Date(share.expiresAt).toLocaleDateString('ru-RU') : 'Без срока'}</p><div className="flex flex-wrap gap-2">{!disabled && <><a href={shareUrl(share.token)} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-2 text-sm">Открыть лендинг ↗</a><button className="rounded-lg border px-3 py-2 text-sm" onClick={() => navigator.clipboard.writeText(shareUrl(share.token)).catch(() => setError('Не удалось скопировать ссылку'))}>Копировать ссылку</button><button className="rounded-lg border border-red-400/50 px-3 py-2 text-sm" onClick={() => revoke(share.id)}>Отозвать</button></>}</div></article>; })}{!shares.length && <p className="text-sm opacity-70">Ссылок пока нет.</p>}</section>
    </div>;
}
