import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth.jsx';
import { useNotifications } from '../store/notifications.jsx';
import { api } from '../api/client.js';

const storageKey = (userId, certificateId) => `mrr:certificate-celebrated:${userId}:${certificateId}`;

export default function CertificateCelebration() {
    const { user, token } = useAuth();
    const { items } = useNotifications();
    const navigate = useNavigate();
    const [award, setAward] = useState(null);
    const [ready, setReady] = useState(false);
    const handled = useRef(new Set());
    const queue = useRef([]);
    const shown = useRef(false);

    const display = useCallback(async (id, replay = false) => {
        if (!id || !token || !user?.id) return;
        const key = storageKey(user.id, id);
        if (!replay && (handled.current.has(id) || localStorage.getItem(key))) return;
        handled.current.add(id);
        if (!replay) localStorage.setItem(key, '1');
        try {
            const certificate = await api(`/courses/certificates/${encodeURIComponent(id)}`, { token });
            queue.current.push(certificate);
            if (!shown.current) {
                shown.current = true;
                setAward(queue.current.shift());
            }
        } catch (error) {
            console.warn('[academy] certificate celebration unavailable', error);
            if (!replay) {
                handled.current.delete(id);
                localStorage.removeItem(key);
            }
        }
    }, [token, user?.id]);

    // New awards arrive through the existing notification socket, on any route.
    // Unread awards received while the app was closed are also picked up on reconnect.
    useEffect(() => {
        if (!user?.id || !token) return;
        for (const item of items) {
            if (item.type === 'certificate' && !item.readAt && item.payload?.certificateId) {
                display(item.payload.certificateId);
            }
        }
    }, [items, display, user?.id, token]);

    // Opening a certificate (from the Academy or a profile) always replays the animation.
    useEffect(() => {
        const onReplay = (event) => display(event.detail?.certificateId, true);
        window.addEventListener('mrr:certificate-replay', onReplay);
        return () => window.removeEventListener('mrr:certificate-replay', onReplay);
    }, [display]);

    useEffect(() => {
        setReady(false);
        if (!award) return;
        const frame = requestAnimationFrame(() => setReady(true));
        return () => cancelAnimationFrame(frame);
    }, [award]);

    const close = () => {
        setReady(false);
        shown.current = false;
        setAward(null);
        if (queue.current.length) {
            shown.current = true;
            setAward(queue.current.shift());
        }
    };
    if (!award) return null;
    return createPortal(
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-8 print:hidden"
            role="dialog" aria-modal="true" aria-label="Получен сертификат"
            onKeyDown={(event) => { if (event.key === 'Escape') close(); }}>
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl transition-opacity duration-700"
                style={{ opacity: ready ? 1 : 0 }} onClick={close} />
            <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
                {Array.from({length: 24}, (_,i) => <div key={i} className="absolute rounded-full"
                    style={{
                        left: (8 + (i * 37) % 84) + '%', top: ready ? (12 + (i * 17) % 78) + '%' : '50%',
                        width: 3 + (i % 4) * 3, height: 3 + (i % 4) * 3,
                        background: i % 2 ? '#E879F9' : '#A78BFA',
                        boxShadow: '0 0 18px #C4B5FD',
                        opacity: ready ? .75 : 0,
                        transition: `all ${700 + (i % 5) * 140}ms cubic-bezier(.16,1,.3,1)`,
                        transform: ready ? 'scale(1)' : 'scale(0)',
                    }} />)}
            </div>
            <div className="relative max-w-xl w-full rounded-3xl border border-violet-300/40 bg-[#141021] p-6 sm:p-10 text-center shadow-[0_0_100px_rgba(139,92,246,.40)]"
                style={{ opacity: ready ? 1 : 0, transform: ready ? 'translateY(0) scale(1)' : 'translateY(40px) scale(.83)', transition: 'transform 800ms cubic-bezier(.16,1,.3,1),opacity 700ms' }}>
                <button type="button" onClick={close} aria-label="Закрыть" className="absolute top-3 right-3 min-w-11 min-h-11 text-white/70 hover:text-white">✕</button>
                <div className="text-5xl sm:text-6xl mb-5" aria-hidden="true"
                    style={{ transform: ready ? 'rotate(0) scale(1)' : 'rotate(-28deg) scale(.3)', transition: 'transform 900ms cubic-bezier(.16,1,.3,1)' }}>🏆</div>
                <p className="text-violet-200 text-xs sm:text-sm uppercase tracking-[.25em] font-bold mb-3">MEDIA · РАФ · RAW</p>
                <h2 className="text-white text-2xl sm:text-4xl font-extrabold leading-tight mb-3">Поздравляем!</h2>
                <p className="text-white/75 text-base mb-3">Ты успешно завершил(а) курс и получил(а) сертификат</p>
                <div className="rounded-2xl p-5 my-5 border border-violet-300/40 bg-gradient-to-br from-violet-700/60 via-indigo-900/70 to-fuchsia-800/40">
                    <div className="text-xs tracking-[.3em] uppercase text-white/70 mb-3">Сертификат</div>
                    <div className="text-white text-xl sm:text-2xl font-bold break-words">{award.title}</div>
                    <div className="text-white/70 text-xs mt-3">№ {award.serial}</div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button type="button" className="btn-primary min-h-11" onClick={() => {
                        const id = award.id;
                        close();
                        navigate(`/app/certificates/${encodeURIComponent(id)}`, { state: { skipCelebration: true } });
                    }}>Посмотреть сертификат →</button>
                    <button type="button" className="btn-ghost min-h-11" onClick={close}>Продолжить</button>
                </div>
            </div>
        </div>, document.body
    );
}
