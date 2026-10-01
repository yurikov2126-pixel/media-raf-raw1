import { useEffect, useRef, useState } from 'react';
import { resolveUrl } from '../api/client.js';

function fmtTime(sec) {
    if (!isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

export default function VoicePlayer({ src, isOwn }) {
    const audioRef = useRef(null);
    const [playing, setPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [current, setCurrent] = useState(0);
    const [error, setError] = useState(false);
    const [bars, setBars] = useState(() =>
        Array.from({ length: 32 }, (_, i) => 0.25 + Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.3)) * 0.7)
    );

    const url = resolveUrl(src);

    useEffect(() => {
        const a = audioRef.current;
        if (!a) return;
        const onLoaded = () => {
            setDuration(a.duration || 0);
            setError(false);
        };
        const onTime = () => setCurrent(a.currentTime || 0);
        const onEnd = () => {
            setPlaying(false);
            setCurrent(0);
            a.currentTime = 0;
        };
        const onErr = () => {
            setError(true);
            setPlaying(false);
        };
        a.addEventListener('loadedmetadata', onLoaded);
        a.addEventListener('timeupdate', onTime);
        a.addEventListener('ended', onEnd);
        a.addEventListener('error', onErr);
        return () => {
            a.removeEventListener('loadedmetadata', onLoaded);
            a.removeEventListener('timeupdate', onTime);
            a.removeEventListener('ended', onEnd);
            a.removeEventListener('error', onErr);
        };
    }, [url]);

    const toggle = () => {
        const a = audioRef.current;
        if (!a) return;
        if (error) {
            // Если не воспроизводится — открываем ссылку в новой вкладке
            window.open(url, '_blank');
            return;
        }
        if (playing) {
            a.pause();
            setPlaying(false);
        } else {
            a.play().catch((e) => {
                console.warn('play failed', e);
                setError(true);
            });
            setPlaying(true);
        }
    };

    const progress = duration > 0 ? current / duration : 0;

    return (
        <div className={`flex items-center gap-2 min-w-[200px] max-w-[280px] rounded-2xl px-3 py-2 ${
            isOwn ? 'bg-black/20' : 'bg-white/10'
        }`}>
            <audio
                ref={audioRef}
                src={url}
                preload="metadata"
                crossOrigin="anonymous"
            />
            <button
                onClick={toggle}
                className={`w-9 h-9 shrink-0 grid place-items-center rounded-full ${
                    isOwn ? 'bg-white/25 text-white' : 'bg-violet/40 text-white'
                } hover:scale-105 transition`}
                title={error ? 'Скачать / открыть' : 'Воспроизвести'}
            >
                {error ? '⬇' : playing ? '❚❚' : '▶'}
            </button>

            <div className="flex-1 flex items-end gap-[2px] h-6">
                {bars.map((h, i) => {
                    const active = i / bars.length <= progress;
                    return (
                        <div
                            key={i}
                            className={`flex-1 rounded-sm transition-colors ${
                                active ? 'bg-white' : 'bg-white/40'
                            }`}
                            style={{ height: `${Math.max(4, h * 24)}px` }}
                        />
                    );
                })}
            </div>

            <div className="text-[10px] opacity-70 shrink-0 tabular-nums w-9 text-right">
                {error ? '!' : fmtTime(playing ? current : duration)}
            </div>
        </div>
    );
}