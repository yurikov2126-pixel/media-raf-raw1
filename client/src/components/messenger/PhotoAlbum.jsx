import { useEffect, useRef, useState } from 'react';
import Avatar from '../Avatar.jsx';
import { resolveUrl } from '../../api/client.js';

export default function PhotoAlbum({ items, own, onlineSet, onOpen, onContext, onProfile }) {
    const sender = items[0].sender;
    const [selected, setSelected] = useState([]);
    const [busy, setBusy] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const pressTimer = useRef(null);
    const gesture = useRef(null);
    useEffect(() => () => clearTimeout(pressTimer.current), []);
    useEffect(() => {
        if (!menuOpen) return undefined;
        const closeOutside = (event) => { if (!menuRef.current?.contains(event.target)) setMenuOpen(false); };
        const closeOnEscape = (event) => { if (event.key === 'Escape') setMenuOpen(false); };
        document.addEventListener('pointerdown', closeOutside);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('pointerdown', closeOutside);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [menuOpen]);
    const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((key) => key !== id) : [...current, id]);
    const startPress = (event, item) => {
        if (event.pointerType !== 'touch') return;
        gesture.current = { x: event.clientX, y: event.clientY, id: item.id, fired: false };
        clearTimeout(pressTimer.current);
        pressTimer.current = setTimeout(() => {
            if (!gesture.current || gesture.current.id !== item.id) return;
            gesture.current.fired = true;
            setSelected((current) => current.includes(item.id) ? current : [...current, item.id]);
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
        try {
            const targets = selected.length ? items.filter((item) => selected.includes(item.id)) : items;
            for (let i = 0; i < targets.length; i++) {
                const item = targets[i];
                const response = await fetch(resolveUrl(item.content), { credentials: 'include' });
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                const extension = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
                link.download = `album-${items[0].albumId || 'photos'}-${i + 1}.${extension}`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            window.alert('Не удалось скачать фотографии: ' + error.message);
        } finally { setBusy(false); }
    };
    return <div className={`mrr-v2-album-row ${own ? 'mrr-v2-album-own' : ''} ${selected.length ? 'mrr-v2-album-selecting' : ''}`} aria-label={`Альбом: ${items.length} фотографий`}>
        {!own && <button type="button" onClick={onProfile} aria-label={sender.fullName}><Avatar user={sender} size={34} online={onlineSet?.has(sender.id)}/></button>}
        <div className="mrr-v2-album-body">
            {!own && <div className="mrr-v2-album-author">{sender.fullName}</div>}
            <div className="mrr-v2-album-grid-wrap">
                <div className="mrr-v2-album-menu" ref={menuRef}>
                    <button type="button" className="mrr-v2-album-menu-trigger" aria-label="Действия с альбомом" aria-expanded={menuOpen} aria-haspopup="menu" onClick={() => setMenuOpen((value) => !value)}>⋯</button>
                    {menuOpen && <div role="menu" className="mrr-v2-album-dropdown">
                        <button role="menuitem" type="button" onClick={() => { setSelected(selected.length ? [] : items.map((item) => item.id)); setMenuOpen(false); }}>{selected.length ? 'Отменить выбор' : 'Выбрать фото'}</button>
                        <button role="menuitem" type="button" disabled={busy} onClick={() => { setMenuOpen(false); download(); }}>{selected.length ? `Скачать выбранные (${selected.length})` : 'Скачать альбом'}</button>
                    </div>}
                </div>
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
                    onContextMenu={(event) => { event.preventDefault(); setMenuOpen(true); }}
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
