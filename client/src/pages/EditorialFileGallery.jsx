import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { usePhotoGestures } from './editorialGestures.js';
import { useEditorialViewerScrollLock } from './editorialViewerScrollLock.js';
import { motion, AnimatePresence } from 'framer-motion';

const BASE = import.meta.env.VITE_API || 'http://localhost:4000/api';
const filePath = id => '/editorial/library/files/' + encodeURIComponent(id);

function Preview({ file, token, onOpen }) {
    const [url, setUrl] = useState('');
    useEffect(() => {
        if (!file.mimeType?.startsWith('image/')) return undefined;
        let objectUrl = '';
        const controller = new AbortController();
        fetch(BASE + filePath(file.id) + '/thumbnail', { headers: { Authorization: 'Bearer ' + token }, signal: controller.signal })
            .then(res => { if (!res.ok) throw new Error('Нет превью'); return res.blob(); })
            .then(blob => { if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } })
            .catch(() => {});
        return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [file.id, file.mimeType, token]);
    return <button type="button" onClick={onOpen} aria-label={'Просмотреть ' + file.name} className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg bg-violet-500/10 focus-visible:outline-2 focus-visible:outline-violet-400">
        {url ? <img src={url} alt={file.name} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform hover:scale-105" /> : <span className="text-4xl">{file.mimeType?.startsWith('video/') ? '🎬' : file.mimeType?.startsWith('image/') ? '🖼️' : '📄'}</span>}
    </button>;
}

function Viewer({ files, index, token, onClose, onNavigate, onUpdate, onError, downloadFile }) {
    useEditorialViewerScrollLock(true);
    const file = files[index];
    const [url, setUrl] = useState('');
    const [name, setName] = useState(file.name);
    const [description, setDescription] = useState(file.description || file.caption || '');
    const [saving, setSaving] = useState(false);
    const [metadata,setMetadata] = useState(null);
    const [compareId,setCompareId] = useState('');
    const [compareUrl,setCompareUrl] = useState('');
    const [slideDirection,setSlideDirection] = useState(0);
    const slide = direction => { setSlideDirection(direction); onNavigate(direction); };
    const gestures = usePhotoGestures({onLeft:()=>slide(1),onRight:()=>slide(-1),onDown:onClose,onUp:onClose});
    useEffect(() => { setName(file.name); setDescription(file.description || file.caption || ''); setMetadata(null); setCompareId(''); api(filePath(file.id) + '/metadata',{token}).then(result=>setMetadata(result.metadata)).catch(()=>{}); }, [file.id, file.name, file.description, file.caption, token]);
    useEffect(() => {
        if (!compareId) { setCompareUrl(''); return undefined; }
        const controller = new AbortController();
        let objectUrl = '';
        fetch(BASE+filePath(compareId)+'/preview',{headers:{Authorization:'Bearer '+token},signal:controller.signal})
            .then(res => { if(!res.ok) throw Error('Сравнение недоступно'); return res.blob(); })
            .then(blob => { if (!controller.signal.aborted) { objectUrl=URL.createObjectURL(blob); setCompareUrl(objectUrl); } })
            .catch(error=>{if(!controller.signal.aborted) onError(error.message);});
        return ()=>{controller.abort();if(objectUrl) URL.revokeObjectURL(objectUrl);};
    },[compareId,token]);
    useEffect(() => {
        const controller = new AbortController();
        let objectUrl = '';
        setUrl('');
        const supported = file.mimeType?.startsWith('image/') || file.mimeType?.startsWith('video/') || file.mimeType === 'application/pdf';
        if (supported) fetch(BASE + filePath(file.id) + (file.mimeType?.startsWith('image/') ? '/preview' : ''), { headers: { Authorization: 'Bearer ' + token }, signal: controller.signal })
            .then(res => { if (!res.ok) throw new Error('Не удалось открыть файл'); return res.blob(); })
            .then(blob => { if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } })
            .catch(error => { if (!controller.signal.aborted) onError(error.message); });
        return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [file.id, file.mimeType, token]);
    useEffect(() => {
        const onKey = event => {
            if (event.key === 'Escape') onClose();
            if (['INPUT','TEXTAREA'].includes(event.target?.tagName)) return;
            if (event.key === 'ArrowLeft') slide(-1);
            if (event.key === 'ArrowRight') slide(1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, onNavigate]);
    async function save() {
        setSaving(true);
        try {
            await api(filePath(file.id), { token, method:'PATCH', body:{ name, description } });
            onUpdate(); onClose();
        } catch (error) { onError(error.message); }
        finally { setSaving(false); }
    }
    return <motion.div key="private-viewer" initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} exit={{opacity:0,y:100}} transition={{duration:.2}} role="dialog" aria-modal="true" aria-label={'Просмотр ' + file.name} className="fixed inset-0 z-[100] flex flex-col bg-slate-950/95 p-3 text-white sm:p-6">
        <header className="flex items-center justify-between gap-2"><span className="min-w-0 truncate font-semibold">{file.name} · {index + 1} / {files.length}</span><button type="button" className="rounded-lg border border-white/40 px-3 py-2" onClick={onClose}>Закрыть ✕</button></header>
        <div {...gestures} className="my-3 flex min-h-0 flex-1 touch-none select-none items-center justify-center overflow-hidden overscroll-none rounded-xl bg-black/30">
            {url && file.mimeType?.startsWith('image/') ? <AnimatePresence mode="wait" initial={false}><motion.div key={file.id} initial={{opacity:0,x:slideDirection*75,scale:.98}} animate={{opacity:1,x:0,scale:1}} exit={{opacity:0,x:-slideDirection*75,scale:.98}} transition={{duration:.22,ease:'easeOut'}} className={compareUrl?'grid h-full w-full grid-cols-2 gap-2':'flex h-full w-full items-center justify-center'}><img src={url} alt={file.name} draggable={false} className="max-h-full max-w-full select-none object-contain" />{compareUrl && <img src={compareUrl} alt="Сравниваемый кадр" className="max-h-full max-w-full object-contain" />}</motion.div></AnimatePresence> :
                url && file.mimeType?.startsWith('video/') ? <video controls src={url} className="max-h-full max-w-full" /> :
                url && file.mimeType === 'application/pdf' ? <iframe title={file.name} src={url} className="h-full w-full bg-white" /> :
                <p className="p-6 text-center text-sm">{file.mimeType?.startsWith('image/') || file.mimeType?.startsWith('video/') || file.mimeType === 'application/pdf' ? 'Загрузка предпросмотра…' : 'Предпросмотр этого формата недоступен'}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="hidden gap-2 sm:flex"><button type="button" className="rounded-lg border border-white/40 px-4 py-2" onClick={() => slide(-1)}>←</button><button type="button" className="rounded-lg border border-white/40 px-4 py-2" onClick={() => slide(1)}>→</button></div><button type="button" className="rounded-lg bg-violet-600 px-4 py-2 font-semibold" onClick={() => downloadFile(filePath(file.id), token, file.name).catch(e => onError(e.message))}>Скачать оригинал</button></div>
        {file.mimeType?.startsWith('image/') && <label className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-200">Сравнить с <select value={compareId} onChange={event=>setCompareId(event.target.value)} className="min-w-0 max-w-full rounded-lg border border-white/30 bg-slate-800 p-2 text-white"><option value="">Не сравнивать</option>{files.filter(item=>item.id!==file.id&&item.mimeType?.startsWith('image/')).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        {metadata && <p className="mt-2 text-xs text-slate-300">{[metadata.width && metadata.height ? metadata.width + " × " + metadata.height + " пикс." : null,metadata.format?.toUpperCase(),(metadata.size/1048576).toFixed(2) + " МБ",metadata.density ? metadata.density + " DPI" : null].filter(Boolean).join(" · ")}</p>}
        {!file.source && <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto]"><input aria-label="Название файла" value={name} onChange={e => setName(e.target.value)} maxLength={255} className="min-w-0 rounded-lg border border-white/30 bg-slate-800 p-2 text-white" /><input aria-label="Описание файла" value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} placeholder="Добавить описание" className="min-w-0 rounded-lg border border-white/30 bg-slate-800 p-2 text-white" /><button type="button" disabled={saving || !name.trim()} onClick={save} className="rounded-lg bg-violet-600 px-4 py-2 font-semibold disabled:opacity-50">{saving ? 'Сохраняем…' : 'Сохранить'}</button></div>}
    </motion.div>;
}

export default function EditorialFileGallery({ files, folders = [], currentFolder, onMove, token, view, selection, setSelection, onShare, onDelete, onUpdate, onError, downloadFile }) {
    const [index, setIndex] = useState(null);
    const [menu,setMenu] = useState(null);
    const timer = useRef(null);
    useEffect(() => { setIndex(null); }, [files.length, view]);
    const openMenu = (file,x,y) => setMenu({file,x:Math.min(x,window.innerWidth-230),y:Math.min(y,window.innerHeight-280)});
    const handlers = file => ({
        onContextMenu: event => {event.preventDefault();openMenu(file,event.clientX,event.clientY);},
        onTouchStart: event => {const touch=event.touches[0];clearTimeout(timer.current);timer.current=setTimeout(()=>openMenu(file,touch.clientX,touch.clientY),550);},
        onTouchMove:()=>clearTimeout(timer.current),
        onTouchEnd:()=>clearTimeout(timer.current),
        onTouchCancel:()=>clearTimeout(timer.current),
    });
    const navigate = delta => setIndex(current => (current + delta + files.length) % files.length);
    return <>
        <div className={view === 'grid' ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'space-y-2'}>
            {files.map((file, i) => <article key={file.id} {...handlers(file)} className={view === 'grid' ? 'group min-w-0 overflow-hidden rounded-xl bg-violet-500/5 transition hover:bg-violet-500/10' : 'flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-current/20 p-3'}>
                <div className={view === 'grid' ? 'w-full' : 'w-24 shrink-0'}><Preview file={file} token={token} onOpen={() => setIndex(i)} /></div>
                <div className="min-w-0 flex-1 px-2 pb-2"><h3 className="truncate text-xs font-semibold">{file.name}</h3><p className="my-1 text-xs opacity-80">{(file.size / 1048576).toFixed(2)} МБ · {new Date(file.createdAt).toLocaleDateString('ru-RU')}{file.taskTitle ? ' · ' + file.taskTitle : ''}{file.version ? ' · Версия ' + file.version : ''}</p>{(file.description || file.caption) && <p className="line-clamp-2 text-xs opacity-85">{file.description || file.caption}</p>}</div>
                <button type="button" aria-label={'Действия с файлом '+file.name} className="mx-2 mb-2 rounded-lg border border-current/20 px-2 py-1 text-xs" onClick={event=>openMenu(file,event.clientX,event.clientY)}>⋯</button>
            </article>)}
        </div>
        {menu && <><button type="button" aria-label="Закрыть контекстное меню" className="fixed inset-0 z-[110] cursor-default" onClick={()=>setMenu(null)} /><div role="menu" className="fixed z-[111] w-52 space-y-1 rounded-xl border border-violet-400/30 bg-slate-900 p-2 text-sm text-white shadow-2xl" style={{left:Math.max(8,menu.x),top:Math.max(8,menu.y)}}>{[['Просмотр',()=>setIndex(files.findIndex(item=>item.id===menu.file.id))],['Скачать',()=>downloadFile(filePath(menu.file.id),token,menu.file.name).catch(error=>onError(error.message))],['Общий доступ',()=>onShare(menu.file)],['В корзину',()=>onDelete(menu.file)],['Выбрать',()=>setSelection(items=>items.includes(menu.file.id)?items.filter(id=>id!==menu.file.id):[...items,menu.file.id])]].map(([label,run])=><button type="button" role="menuitem" key={label} onClick={()=>{setMenu(null);run();}} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-violet-600/40">{label}</button>)}{!menu.file.source && <label className="block px-2 text-xs">Переместить<select className="mt-1 w-full rounded-lg bg-slate-700 p-2 text-white" value={currentFolder||''} onChange={event=>{onMove(menu.file,event.target.value||null);setMenu(null);}}><option value="">Корень</option>{folders.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}</div></>}
        <AnimatePresence>{index !== null && files[index] && <Viewer files={files} index={index} token={token} onClose={() => setIndex(null)} onNavigate={navigate} onUpdate={onUpdate} onError={onError} downloadFile={downloadFile} />}</AnimatePresence>
    </>;
}
