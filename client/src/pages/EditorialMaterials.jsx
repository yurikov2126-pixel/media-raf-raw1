import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import EditorialMaterialViewer from './EditorialMaterialViewer.jsx';
import { batchUploadProgress, removeUploadedItem, canSubmitReview } from './editorialUploadUtils.js';

const API = import.meta.env.VITE_API || 'http://localhost:4000/api';

// Thumbnails use the protected file endpoint; never expose private disk URLs.
function MaterialTile({ file, base, token, onOpen, canRename, onRename }) {
    const [thumb, setThumb] = useState(null);
    const [failed, setFailed] = useState(false);
    const tileRef = useRef(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        if (!tileRef.current) return undefined;
        const observer = new IntersectionObserver(entries => { if (entries[0]?.isIntersecting) { setVisible(true); observer.disconnect(); } }, { rootMargin:'200px' });
        observer.observe(tileRef.current);
        return () => observer.disconnect();
    }, []);
    const isImage = file.mimeType?.startsWith('image/');
    const isVideo = file.mimeType?.startsWith('video/');
    useEffect(() => {
        if (!isImage || !visible) return undefined;
        let active = true;
        let url;
        const controller = new AbortController();
        (async () => {
            try {
                const response = await fetch(API + base + '/' + file.id + '/thumbnail', {
                    headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
                });
                if (!response.ok) throw new Error('Preview unavailable');
                const blob = await response.blob();
                if (!active) return;
                url = URL.createObjectURL(blob);
                setThumb(url);
            } catch (error) {
                if (active && error.name !== 'AbortError') setFailed(true);
            }
        })();
        return () => { active = false; controller.abort(); if (url) URL.revokeObjectURL(url); };
    }, [base, file.id, isImage, token, visible]);
    return <article ref={tileRef} className="editorial-material-tile min-w-0 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-800">
        <button type="button" onClick={() => onOpen(file)} aria-label={`Просмотреть: ${file.name}`} className="group block w-full text-left text-slate-900 focus-visible:outline-2 focus-visible:outline-violet-500 dark:text-slate-100">
            <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                {isImage && thumb ? <img src={thumb} alt={file.caption || file.name} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" /> :
                    <span className="flex flex-col items-center gap-2 text-center"><span aria-hidden="true" className="text-4xl">{isVideo ? '🎬' : file.mimeType === 'application/pdf' ? '📄' : isImage && !failed ? '⏳' : '📎'}</span><span className="text-xs">{isVideo ? 'Видео' : isImage ? (failed ? 'Нет миниатюры' : 'Загрузка…') : 'Документ'}</span></span>}
                <span className="absolute bottom-2 right-2 rounded-md bg-slate-950/80 px-2 py-1 text-xs font-semibold text-white">Открыть ↗</span>
            </div>
            <div className="space-y-1 bg-white p-3 dark:bg-slate-800">
                <p className="break-words text-sm font-semibold text-slate-900 dark:text-slate-100">{file.name}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300">{(file.size / 1024 / 1024).toFixed(1)} МБ · {new Date(file.createdAt).toLocaleString('ru-RU')}</p>
                <p className="whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">{file.caption || 'Без подписи'}</p>
            </div>
        </button>
        {canRename && <button type="button" onClick={() => onRename(file)} className="mx-3 mb-3 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-500 dark:text-slate-100">Изменить подпись</button>}
    </article>;
}

export default function EditorialMaterials({ project, task, token, user, canEdit, refresh, onError, onClose }) {
    const [files,setFiles]=useState([]);
    const [selected,setSelected]=useState([]);
    const [progress,setProgress]=useState(null);
    const [batchProgress,setBatchProgress]=useState(null);
    const xhrRef = useRef(null);
    const cancelledRef = useRef(false);
    const [busy,setBusy]=useState(false);
    const [preview,setPreview]=useState(null);
    const [archiveBusy,setArchiveBusy]=useState(false);
    const [note,setNote]=useState('');
    const [message,setMessage]=useState('');
    const [reviewError,setReviewError]=useState('');
    const [currentStatus,setCurrentStatus]=useState(task.status);
    useEffect(()=>{setCurrentStatus(task.status);},[task.status]);
    const base=`/editorial/materials/projects/${project.id}/tasks/${task.id}/materials`;
    const reviewBase=`/editorial/workflow/projects/${project.id}/tasks/${task.id}/review`;
    const canUpload=(canEdit||task.assigneeId===user?.id)&&['TODO','IN_PROGRESS','REVISION'].includes(currentStatus);
    const canSubmit=task.assigneeId===user?.id&&['TODO','IN_PROGRESS','REVISION'].includes(currentStatus);
    const canReview=canEdit&&currentStatus==='IN_REVIEW';
    // The newest version is shown first; no search/filter/sort controls.
    const visibleFiles = [...files].sort((a,b) => Number(b.version)-Number(a.version) || new Date(b.createdAt)-new Date(a.createdAt));
    const visibleVersions = [...new Set(visibleFiles.map(file => file.version))].sort((a,b) => b-a);

    async function downloadArchive(version) {
        if (archiveBusy) return;
        setArchiveBusy(true);
        try {
            const suffix = version === null ? '' : `?version=${encodeURIComponent(version)}`;
            const response = await fetch(API + base + '/archive' + suffix, {
                headers: { Authorization: `Bearer ${token}` }, cache:'no-store',
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'Не удалось скачать архив');
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            try {
                const link = document.createElement('a');
                link.href = url;
                link.download = version === null ? 'materials-all.zip' : `materials-version-${version}.zip`;
                document.body.appendChild(link);
                link.click();
                link.remove();
            } finally { window.setTimeout(() => URL.revokeObjectURL(url), 60000); }
        } catch(error) { onError(error.message); }
        finally { setArchiveBusy(false); }
    }
    async function load() {
        try {const result=await api(base,{token});setFiles(result.files||[]);}
        catch(e){onError(e.message);}
    }
    useEffect(()=>{load();},[base,token]);
    function open(file) { setPreview(file.id); }
    function uploadOne(file,caption) {
        return new Promise((resolve,reject)=>{
            if (cancelledRef.current) { reject(new Error('Загрузка отменена')); return; }
            const xhr=new XMLHttpRequest();
            xhrRef.current=xhr;
            xhr.open('POST',API+base);
            xhr.setRequestHeader('Authorization',`Bearer ${token}`);
            xhr.upload.onprogress=(event)=>{if(event.lengthComputable)setProgress(Math.round(event.loaded/event.total*100));};
            xhr.onload=()=>{let data={};try{data=JSON.parse(xhr.responseText);}catch{}if(xhr.status>=200&&xhr.status<300)resolve(data);else reject(new Error(data.error||'Ошибка загрузки'));};
            xhr.onerror=()=>reject(new Error('Сетевая ошибка при загрузке'));
            xhr.onabort=()=>reject(new Error('Загрузка отменена'));
            xhr.onloadend=()=>{ if (xhrRef.current === xhr) xhrRef.current=null; };
            const body=new FormData();body.append('file',file);body.append('caption',caption);xhr.send(body);
        });
    }
    async function uploadSelected() {
        cancelledRef.current=false;
        const pending = [...selected];
        for (const [index,item] of pending.entries()) {
            if (cancelledRef.current) throw new Error('Загрузка отменена');
            setBatchProgress({ completed:index, total:pending.length, name:item.file.name });
            setProgress(0);
            await uploadOne(item.file, item.caption);
            // Preserve only not-yet-uploaded files if a later upload fails.
            setSelected((items) => removeUploadedItem(items, item));
            setBatchProgress({ completed:index+1, total:pending.length, name:item.file.name });
        }
        setProgress(null);
        setBatchProgress(null);
        await load();
    }
    async function saveDraft() {
        if (!selected.length || busy) return;
        setBusy(true); setMessage('');
        try {
            await uploadSelected();
            setMessage('Черновик сохранён. Материалы ещё не отправлены редактору.');
        } catch (error) { onError(error.message); }
        finally { setBusy(false); setProgress(null); setBatchProgress(null); }
    }
    async function submitAll() {
        if (!canSubmitReview({ busy, pendingCount:selected.length, uploadedCount:files.length })) return;
        setBusy(true); setMessage('');
        try {
            if (selected.length) await uploadSelected();
            const result = await api(reviewBase, { method: 'POST', token, body: { action: 'submit', note } });
            setCurrentStatus(result.task.status);
            setNote('');
            try { await refresh(); } catch { /* Server confirmed submission; keep success. */ }
            setMessage('Материалы отправлены на проверку.');
            onClose?.();
        } catch (error) {
            onError(error.message);
            setMessage('Отправка не завершена. Уже загруженные файлы сохранены; можно повторить попытку.');
            await load();
        } finally { setBusy(false); setProgress(null); setBatchProgress(null); }
    }
    async function updateCaption(file,caption) {
        try {await api(base+'/'+file.id,{method:'PATCH',token,body:{caption}});await load();}
        catch(e){onError(e.message);}
    }
    async function review(action) {
        if (action === 'revise' && !note.trim()) { setReviewError('Напишите, что именно нужно исправить. После этого материал можно вернуть на доработку.'); return; }
        setReviewError('');
        setBusy(true);setMessage('');
        try {
            const result=await api(reviewBase,{method:'POST',token,body:{action,note}});
            setCurrentStatus(result.task.status);
            setNote('');await refresh();await load();setMessage(action==='submit'?'Результат отправлен редактору.':action==='approve'?'Материал утверждён.':'Материал возвращён на доработку.');
        }catch(e){onError(e.message);}
        finally{setBusy(false);}
    }
    return <section className="space-y-4" aria-label="Материалы задания">
        <div><h3 className="font-semibold">Материалы и согласование</h3><p className="text-xs opacity-65">Файлы доступны только участникам проекта. Предыдущие версии сохраняются.</p></div>
        <div role="status" className="rounded-lg border border-current/15 bg-white/30 px-3 py-2 text-sm dark:bg-slate-800/30"><strong>Статус задания:</strong> {{TODO:'К выполнению',IN_PROGRESS:'В работе',IN_REVIEW:'На проверке',REVISION:'На доработке',APPROVED:'Утверждено',DONE:'Завершено'}[currentStatus]||currentStatus}</div>
        {canReview&&<p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 dark:border-amber-600/50 dark:bg-amber-950/50 dark:text-amber-100">Материал ожидает вашего решения. Просмотрите галерею ниже, затем выберите «Утвердить» или «На доработку».</p>}
        {canUpload&&<div className="space-y-3 rounded-xl border border-current/15 bg-white/30 p-3 dark:bg-slate-800/30">
            <label className="block text-sm font-medium">Выберите фотографии, видео или документы
                <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf,text/plain,.doc,.docx" disabled={busy} onChange={e=>{setSelected(prev=>[...prev,...Array.from(e.target.files||[]).map(file=>({file,caption:''}))]);e.target.value='';}} className="mt-2 block w-full text-sm" />
            </label>
            {selected.map((item,i)=><div key={i} className="rounded-lg border border-current/10 p-2"><div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-sm">{item.file.name}</span><button type="button" onClick={()=>setSelected(v=>v.filter((_,j)=>j!==i))} className="text-xs underline">Убрать</button></div><input value={item.caption} maxLength={1000} placeholder="Подпись к файлу" onChange={e=>setSelected(v=>v.map((x,j)=>j===i?{...x,caption:e.target.value}:x))} className="mt-2 w-full rounded-lg border border-current/20 bg-transparent p-2 text-sm" /></div>)}
            {batchProgress&&<div role="status" className="space-y-2 rounded-lg border border-slate-300 p-3 dark:border-slate-600"><div className="text-sm font-medium">Файл {batchProgress.completed+1} из {batchProgress.total}: {batchProgress.name}</div><progress aria-label="Общий прогресс загрузки" value={batchUploadProgress(batchProgress.completed,batchProgress.total,progress)} max={100} className="w-full"/><div className="text-xs">Текущий файл: {progress||0}% · Загружено: {batchProgress.completed} из {batchProgress.total}</div><progress aria-label="Прогресс текущего файла" value={progress||0} max="100" className="w-full"/><button type="button" onClick={()=>{cancelledRef.current=true;xhrRef.current?.abort();}} className="min-h-11 rounded-lg border border-rose-400 px-3 py-2 text-sm font-semibold text-rose-700 dark:text-rose-200">Отменить загрузку</button></div>}
            {selected.length>0&&<p className="text-xs opacity-65">Файлы загрузятся автоматически при отправке на проверку.</p>}
        </div>}
        {(canSubmit||canReview)&&<div className="space-y-2 rounded-xl border border-violet-300/30 bg-violet-100/20 p-3 dark:bg-violet-300/10"><h4 className="font-semibold">Согласование</h4><textarea rows={3} maxLength={10000} value={note} onChange={e=>{setNote(e.target.value);setReviewError('');}} placeholder={canReview?'Обязательно напишите, что нужно исправить…':'Комментарий к результату…'} className="w-full rounded-lg border border-current/20 bg-transparent p-2 text-sm"/><div className="flex flex-wrap gap-2">{canSubmit&&<><button type="button" disabled={busy||(selected.length===0&&files.length===0)} onClick={submitAll} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Отправляем…' : 'Отправить на проверку'}</button>{selected.length>0&&<button type="button" disabled={busy} onClick={saveDraft} className="rounded-lg border border-current/20 px-3 py-2 text-sm disabled:opacity-50">Сохранить черновик</button>}</>}{canReview&&<><button type="button" disabled={busy} onClick={()=>review('approve')} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Утвердить</button><button type="button" disabled={busy} onClick={()=>review('revise')} className="rounded-lg border border-amber-500 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-200 disabled:opacity-50 dark:border-amber-400 dark:bg-amber-500/20 dark:text-amber-100 dark:hover:bg-amber-500/30">Вернуть на доработку</button></>}</div>{canReview&&<p className="text-xs text-slate-600 dark:text-slate-200">Для возврата на доработку требуется замечание редактора.</p>}{reviewError&&<p role="alert" className="text-sm font-medium text-rose-700 dark:text-rose-300">{reviewError}</p>}</div>}
        {files.length > 0 && <div className="editorial-gallery-heading flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
            <h4 className="text-base font-semibold">Материалы <span className="text-sm font-normal text-slate-600 dark:text-slate-300">· {files.length} файл(ов)</span></h4>
            <button type="button" disabled={archiveBusy} onClick={() => downloadArchive(null)} className="min-h-11 rounded-lg border border-violet-500 bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"> {archiveBusy ? "Подготовка архива…" : "Скачать все ZIP ↓"} </button>
        </div>}
        {files.length===0 ? <p className="text-sm opacity-70">Материалы ещё не загружены.</p> :
         visibleVersions.map(version =>
            <section key={version} className="space-y-3" aria-label={`Материалы версии ${version}`}>
                <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">Версия {version}</h4><div className="flex items-center gap-2"><span className="text-xs text-slate-600 dark:text-slate-300">{visibleFiles.filter(f => f.version === version).length} файл(ов)</span><button type="button" disabled={archiveBusy} onClick={() => downloadArchive(version)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-60 dark:border-slate-500 dark:bg-slate-800 dark:text-violet-200">ZIP версии ↓</button></div></div>
                <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {visibleFiles.filter(f => f.version === version).map(file => <MaterialTile key={file.id} file={file} base={base} token={token} onOpen={open}
                        canRename={canUpload && (canEdit || file.uploaderId === user?.id)}
                        onRename={(item) => { const caption = window.prompt('Подпись к файлу', item.caption || ''); if (caption !== null) updateCaption(item, caption); }} />)}
                </div>
            </section>
        )}
        {currentStatus==='IN_REVIEW'&&!canReview&&<p className="text-sm opacity-65">Материалы ожидают проверки редактором.</p>}
        {message&&<p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}
        {preview&&<EditorialMaterialViewer files={files} initialId={preview} base={base} token={token} onClose={()=>setPreview(null)} onError={onError} />}
    </section>;
}
