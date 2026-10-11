import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

const BASE = import.meta.env.VITE_API || 'http://localhost:4000/api';
export async function downloadEditorialFile(path, token, name) {
    const response = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + token } });
    if (!response.ok) throw new Error('Не удалось скачать файл');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export default function EditorialFiles() {
    const { token } = useAuth();
    const [files, setFiles] = useState([]);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(null);
    const [refresh, setRefresh] = useState(0);
    useEffect(() => { let active = true; api('/editorial/library/files', { token }).then(data => { if (active) setFiles(data.files); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [token, refresh]);
    function upload(event) {
        const selected = event.target.files?.[0];
        if (!selected) return;
        setBusy(true); setError(''); setProgress(0);
        const xhr = new XMLHttpRequest();
        xhr.open('POST', BASE + '/editorial/library/files');
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.upload.onprogress = e => { if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 100)); };
        xhr.onload = () => { setBusy(false); setProgress(null); if (xhr.status >= 200 && xhr.status < 300) setRefresh(n => n + 1); else { try { setError(JSON.parse(xhr.responseText).error || 'Ошибка загрузки'); } catch { setError('Ошибка загрузки'); } } };
        xhr.onerror = () => { setBusy(false); setProgress(null); setError('Сетевая ошибка'); };
        const form = new FormData(); form.append('file', selected); xhr.send(form);
        event.target.value = '';
    }
    async function remove(file) {
        if (!window.confirm('Удалить файл «' + file.name + '»? Он также исчезнет из общих ссылок.')) return;
        try { await api('/editorial/library/files/' + file.id, { token, method: 'DELETE' }); setRefresh(n => n + 1); }
        catch (e) { setError(e.message); }
    }
    return <div className="editorial-workspace-content space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Файлы редакции</h2><p className="text-sm opacity-70">Закрытое хранилище для передачи материалов другим подразделениям.</p></div><label className="cursor-pointer rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white">+ Загрузить файл<input type="file" className="sr-only" onChange={upload} disabled={busy} /></label></div>
        {progress !== null && <div role="status" className="space-y-1 text-sm"><span>Загрузка: {progress}%</span><progress max="100" value={progress} className="block w-full" /></div>}
        {error && <p role="alert" className="rounded-lg border border-red-500 p-3">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{files.map(file => <article key={file.id} className="rounded-xl border border-current/20 p-4"><div className="mb-2 text-2xl">{file.mimeType.startsWith('image/') ? '🖼️' : file.mimeType.startsWith('video/') ? '🎬' : '📄'}</div><h3 className="break-all font-semibold">{file.name}</h3><p className="my-2 text-xs opacity-70">{(file.size / 1048576).toFixed(2)} МБ · {new Date(file.createdAt).toLocaleDateString('ru-RU')}</p><div className="flex flex-wrap gap-2"><button className="rounded-lg border px-3 py-2 text-sm" onClick={() => downloadEditorialFile('/editorial/library/files/' + file.id, token, file.name).catch(e => setError(e.message))}>Скачать</button><button className="rounded-lg border border-red-400/50 px-3 py-2 text-sm" onClick={() => remove(file)}>Удалить</button></div></article>)}</div>
        {!files.length && !error && <p className="rounded-xl border border-dashed p-6 text-center text-sm opacity-70">Здесь пока нет файлов. Загрузите первый материал.</p>}
    </div>;
}
