import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

const API = import.meta.env.VITE_API || 'http://localhost:4000/api';
export default function EditorialMaterials({ project, task, token, user, canEdit, refresh, onError, onClose }) {
    const [files,setFiles]=useState([]);
    const [selected,setSelected]=useState([]);
    const [progress,setProgress]=useState(null);
    const [busy,setBusy]=useState(false);
    const [preview,setPreview]=useState(null);
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
    async function load() {
        try {const result=await api(base,{token});setFiles(result.files||[]);}
        catch(e){onError(e.message);}
    }
    useEffect(()=>{load();},[base,token]);
    useEffect(()=>()=>{if(preview?.url)URL.revokeObjectURL(preview.url);},[preview]);
    async function open(file) {
        try {
            const res=await fetch(API+base+'/'+file.id+'/content',{headers:{Authorization:`Bearer ${token}`}});
            if(!res.ok)throw new Error('Не удалось открыть файл');
            const blob=await res.blob();
            setPreview({file,url:URL.createObjectURL(blob)});
        }catch(e){onError(e.message);}
    }
    function uploadOne(file,caption) {
        return new Promise((resolve,reject)=>{
            const xhr=new XMLHttpRequest();
            xhr.open('POST',API+base);
            xhr.setRequestHeader('Authorization',`Bearer ${token}`);
            xhr.upload.onprogress=(event)=>{if(event.lengthComputable)setProgress(Math.round(event.loaded/event.total*100));};
            xhr.onload=()=>{let data={};try{data=JSON.parse(xhr.responseText);}catch{}if(xhr.status>=200&&xhr.status<300)resolve(data);else reject(new Error(data.error||'Ошибка загрузки'));};
            xhr.onerror=()=>reject(new Error('Сетевая ошибка при загрузке'));
            const body=new FormData();body.append('file',file);body.append('caption',caption);xhr.send(body);
        });
    }
    async function uploadSelected() {
        const pending = [...selected];
        for (const item of pending) {
            setProgress(0);
            await uploadOne(item.file, item.caption);
            // Preserve only not-yet-uploaded files if a later upload fails.
            setSelected((items) => items.filter((entry) => entry !== item));
        }
        setProgress(null);
        await load();
    }
    async function saveDraft() {
        if (!selected.length || busy) return;
        setBusy(true); setMessage('');
        try {
            await uploadSelected();
            setMessage('Черновик сохранён. Материалы ещё не отправлены редактору.');
        } catch (error) { onError(error.message); }
        finally { setBusy(false); setProgress(null); }
    }
    async function submitAll() {
        if (busy || (!selected.length && !files.length)) return;
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
        } finally { setBusy(false); setProgress(null); }
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
    const versions=[...new Set(files.map(f=>f.version))].sort((a,b)=>b-a);
    return <section className="space-y-4" aria-label="Материалы задания">
        <div><h3 className="font-semibold">Материалы и согласование</h3><p className="text-xs opacity-65">Файлы доступны только участникам проекта. Предыдущие версии сохраняются.</p></div>
        <div role="status" className="rounded-lg border border-current/15 bg-white/30 px-3 py-2 text-sm dark:bg-slate-800/30"><strong>Статус задания:</strong> {{TODO:'К выполнению',IN_PROGRESS:'В работе',IN_REVIEW:'На проверке',REVISION:'На доработке',APPROVED:'Утверждено',DONE:'Завершено'}[currentStatus]||currentStatus}</div>
        {canReview&&<p className="rounded-lg bg-amber-100/50 px-3 py-2 text-sm font-medium text-amber-900 dark:bg-amber-300/10 dark:text-amber-100">Материал ожидает вашего решения. Просмотрите прикреплённые файлы ниже, затем выберите «Утвердить» или «На доработку».</p>}
        {canUpload&&<div className="space-y-3 rounded-xl border border-current/15 bg-white/30 p-3 dark:bg-slate-800/30">
            <label className="block text-sm font-medium">Выберите фотографии, видео или документы
                <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf,text/plain,.doc,.docx" disabled={busy} onChange={e=>{setSelected(prev=>[...prev,...Array.from(e.target.files||[]).map(file=>({file,caption:''}))]);e.target.value='';}} className="mt-2 block w-full text-sm" />
            </label>
            {selected.map((item,i)=><div key={i} className="rounded-lg border border-current/10 p-2"><div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-sm">{item.file.name}</span><button type="button" onClick={()=>setSelected(v=>v.filter((_,j)=>j!==i))} className="text-xs underline">Убрать</button></div><input value={item.caption} maxLength={1000} placeholder="Подпись к файлу" onChange={e=>setSelected(v=>v.map((x,j)=>j===i?{...x,caption:e.target.value}:x))} className="mt-2 w-full rounded-lg border border-current/20 bg-transparent p-2 text-sm" /></div>)}
            {progress!==null&&<div role="status"><div className="text-xs">Загрузка: {progress}%</div><progress value={progress} max="100" className="w-full"/></div>}
            {selected.length>0&&<p className="text-xs opacity-65">Файлы загрузятся автоматически при отправке на проверку.</p>}
        </div>}
        {(canSubmit||canReview)&&<div className="space-y-2 rounded-xl border border-violet-300/30 bg-violet-100/20 p-3 dark:bg-violet-300/10"><h4 className="font-semibold">Согласование</h4><textarea rows={3} maxLength={10000} value={note} onChange={e=>{setNote(e.target.value);setReviewError('');}} placeholder={canReview?'Обязательно напишите, что нужно исправить…':'Комментарий к результату…'} className="w-full rounded-lg border border-current/20 bg-transparent p-2 text-sm"/><div className="flex flex-wrap gap-2">{canSubmit&&<><button type="button" disabled={busy||(selected.length===0&&files.length===0)} onClick={submitAll} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Отправляем…' : 'Отправить на проверку'}</button>{selected.length>0&&<button type="button" disabled={busy} onClick={saveDraft} className="rounded-lg border border-current/20 px-3 py-2 text-sm disabled:opacity-50">Сохранить черновик</button>}</>}{canReview&&<><button type="button" disabled={busy} onClick={()=>review('approve')} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Утвердить</button><button type="button" disabled={busy} onClick={()=>review('revise')} className="rounded-lg border border-amber-500 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-200 disabled:opacity-50 dark:border-amber-400 dark:bg-amber-500/20 dark:text-amber-100 dark:hover:bg-amber-500/30">Вернуть на доработку</button></>}</div>{canReview&&<p className="text-xs text-slate-600 dark:text-slate-300">Для возврата на доработку требуется замечание редактора.</p>}{reviewError&&<p role="alert" className="text-sm font-medium text-rose-700 dark:text-rose-300">{reviewError}</p>}</div>}
        {versions.length===0?<p className="text-sm opacity-65">Материалы ещё не загружены.</p>:versions.map(version=><div key={version} className="space-y-2"><h4 className="text-sm font-semibold">Версия {version}</h4>{files.filter(f=>f.version===version).map(file=><div key={file.id} className="rounded-xl border border-current/15 bg-white/30 p-3 dark:bg-slate-800/30"><button type="button" onClick={()=>open(file)} className="max-w-full break-all text-left text-sm font-medium text-violet-700 underline dark:text-violet-200">{file.name}</button><p className="text-xs opacity-60">{(file.size/1024/1024).toFixed(1)} МБ · {new Date(file.createdAt).toLocaleString('ru-RU')}</p><p className="mt-1 whitespace-pre-wrap text-sm">{file.caption||'Без подписи'}</p>{canUpload&&(canEdit||file.uploaderId===user?.id)&&<button type="button" onClick={()=>{const caption=window.prompt('Подпись к файлу',file.caption||'');if(caption!==null)updateCaption(file,caption);}} className="mt-2 text-xs underline">Изменить подпись</button>}</div>)}</div>)}
        {currentStatus==='IN_REVIEW'&&!canReview&&<p className="text-sm opacity-65">Материалы ожидают проверки редактором.</p>}
        {message&&<p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}
        {preview&&<div className="fixed inset-0 z-[10050] flex flex-col bg-slate-950 p-3 text-white" role="dialog" aria-modal="true" aria-label="Просмотр материала"><div className="flex items-center justify-between gap-3 py-3"><span className="min-w-0 truncate text-sm">{preview.file.name}</span><button type="button" onClick={()=>setPreview(null)} className="rounded-lg border border-white/30 px-3 py-2">Закрыть</button></div><div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">{preview.file.mimeType.startsWith('image/')?<img src={preview.url} alt={preview.file.caption||preview.file.name} className="max-h-full max-w-full object-contain"/>:preview.file.mimeType.startsWith('video/')?<video controls src={preview.url} className="max-h-full max-w-full"/>:preview.file.mimeType==='application/pdf'?<iframe title={preview.file.name} src={preview.url} className="h-full w-full bg-white"/>:<a href={preview.url} download={preview.file.name} className="underline">Скачать файл</a>}</div></div>}
    </section>;
}
