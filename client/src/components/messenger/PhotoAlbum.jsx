import { useEffect, useRef, useState } from 'react';
import Avatar from '../Avatar.jsx';
import { resolveUrl } from '../../api/client.js';
import { buildAlbumZip } from '../../lib/albumZip.js';

export default function PhotoAlbum({ items, own, onlineSet, onOpen, onContext, onProfile }) {
    const sender = items[0].sender;
    const forwarded = items[0].forwardedFrom ? (() => { try { return JSON.parse(items[0].forwardedFrom); } catch { return null; } })() : null;
    const [selected, setSelected] = useState([]);
    const [busy, setBusy] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(null);

    const pressTimer = useRef(null);
    const gesture = useRef(null);
    useEffect(() => () => clearTimeout(pressTimer.current), []);
    useEffect(() => {
        const onAction = (event) => {
            if (event.detail?.albumId !== items[0]?.albumId) return;
            if (event.detail.action === 'select') setSelected((current) => current.length ? [] : items.map((item) => item.id));
            if (event.detail.action === 'download') download();
        };
        window.addEventListener('mrr:album-action', onAction);
        return () => window.removeEventListener('mrr:album-action', onAction);
    });
    const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((key) => key !== id) : [...current, id]);
    const startPress = (event, item) => {
        if (event.pointerType !== 'touch') return;
        gesture.current = { x: event.clientX, y: event.clientY, id: item.id, fired: false };
        clearTimeout(pressTimer.current);
        pressTimer.current = setTimeout(() => {
            if (!gesture.current || gesture.current.id !== item.id) return;
            gesture.current.fired = true;
            if (selected.length) setSelected((current) => current.includes(item.id) ? current : [...current, item.id]);
            else onContext(item, { clientX: gesture.current.x, clientY: gesture.current.y });
        }, 480);
    };
    const movePress = (event) => {
        if (gesture.current && Math.hypot(event.clientX - gesture.current.x, event.clientY - gesture.current.y) > 12) {
            clearTimeout(pressTimer.current);
            gesture.current = null;
        }
    };
    const stopPress = () => { clearTimeout(pressTimer.current); };
    const download = async () => {
        if (busy) return;
        setBusy(true);
        setDownloadProgress(0);
        try {
            const targets = selected.length ? items.filter((item) => selected.includes(item.id)) : items;
            const entries = [];
            let total = 0;
            const maxBytes = 150 * 1024 * 1024;
            for (let i = 0; i < targets.length; i++) {
                const item = targets[i];
                const response = await fetch(resolveUrl(item.content), { credentials: 'include' });
                if (!response.ok) throw new Error('Ошибка загрузки фото: HTTP ' + response.status);
                const data = new Uint8Array(await response.arrayBuffer());
                total += data.length;
                if (total > maxBytes) throw new Error('Альбом больше 150 МБ. Скачайте фотографии частями.');
                const mime = response.headers.get('content-type') || '';
                const path = new URL(resolveUrl(item.content), window.location.href).pathname;
                const extFromPath = path.split('.').pop()?.toLowerCase();
                const ext = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'avif'].includes(extFromPath) ? extFromPath
                    : mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp'
                    : mime.includes('gif') ? 'gif' : mime.includes('heic') ? 'heic' : 'jpg';
                entries.push({ name: `photo-${String(i + 1).padStart(2, '0')}.${ext}`, data });
                setDownloadProgress(Math.round(((i + 1) / targets.length) * 100));
            }
            const blob = buildAlbumZip(entries);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `album-${items[0].albumId || 'photos'}.zip`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 30000);
        } catch (error) {
            window.alert('Не удалось скачать альбом: ' + error.message);
        } finally { setBusy(false); setDownloadProgress(null); }
    };
    return <div className={`mrr-v2-album-row ${own ? 'mrr-v2-album-own' : ''} ${selected.length ? 'mrr-v2-album-selecting' : ''}`} aria-label={`Альбом: ${items.length} фотографий`}>
        {!own && <button type="button" onClick={onProfile} aria-label={sender.fullName}><Avatar user={sender} size={34} online={onlineSet?.has(sender.id)}/></button>}
        <div className="mrr-v2-album-body">
            {!own && <div className="mrr-v2-album-author">{sender.fullName}</div>}
            {forwarded && <div className="mrr-v2-album-author">↪ Переслано от {forwarded.fullName}</div>}
            <div className="mrr-v2-album-grid-wrap">
                <button type="button" className="mrr-v2-album-menu-trigger mrr-v2-album-unified-trigger" aria-label="Действия с альбомом" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); onContext(items[0], { clientX: rect.left, clientY: rect.bottom }); }}>⋯</button>
            <div className="mrr-v2-album-grid">
                {items.map((item, index) => <button
                    type="button" key={item.id} id={`msg-${item.id}`}
                    className={`mrr-v2-album-tile ${selected.includes(item.id) ? 'mrr-v2-album-selected' : ''}`}
                    onPointerDown={(event) => startPress(event, item)}
                    onPointerMove={movePress}
                    onPointerUp={stopPress}
                    onPointerCancel={() => { stopPress(); gesture.current = null; }}
                    onClick={() => {
                        if (gesture.current?.fired) { gesture.current = null; return; }
                        gesture.current = null;
                        if (selected.length) toggle(item.id); else onOpen(item.id);
                    }}
                    onContextMenu={(event) => { event.preventDefault(); if (gesture.current?.fired) return; onContext(item, event); }}
                    aria-pressed={selected.includes(item.id)}
                    aria-label={`${selected.includes(item.id) ? 'Выбрано' : 'Открыть'} фото ${index + 1} из ${items.length}`}>
                    <img src={resolveUrl(item.content)} alt={item.caption || `Фото ${index + 1}`} loading="lazy" />
                    {selected.includes(item.id) && <span className="mrr-v2-album-check" aria-hidden="true">✓</span>}
                </button>)}
            </div>
            </div>
            {items.some(item => item.caption) && <div className="mrr-v2-album-captions">
                {items.map((item, i) => item.caption && <div key={item.id}><b>{i + 1}.</b> {item.caption}</div>)}
            </div>}
            <div className="mrr-v2-album-time">{new Date(items[items.length - 1].createdAt).toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'})}</div>
        </div>
    </div>;
}
