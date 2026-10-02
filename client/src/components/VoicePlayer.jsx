import { useEffect, useMemo, useRef, useState } from 'react';
import { resolveUrl } from '../api/client.js';

const RATES = [1, 1.5, 2, 3, 4];
const RATE_KEY = 'mrr_voice_rate';

/* Глобальный указатель на текущий играющий <audio>.
   При старте нового голосового предыдущий останавливается. */
let currentlyPlaying = null;

function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

/* Детерминированный waveform из строки src.
   Один и тот же файл всегда даёт одну и ту же форму,
   разные файлы — разную (не синусоида-заглушка, как раньше). */
function makeBars(seedStr, count = 42) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seedStr.length; i++) {
        h ^= seedStr.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    let s = h;
    const arr = new Array(count);
    for (let i = 0; i < count; i++) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        const v = (s % 1000) / 1000;
        // огибающая — форма «дышит» как речь, а не ровный шум
        const env = 0.35 + 0.65 * Math.sin((i / (count - 1)) * Math.PI);
        arr[i] = 0.14 + v * env * 0.86;
    }
    return arr;
}

function readStoredRate() {
    try {
        const v = parseFloat(localStorage.getItem(RATE_KEY) || '1');
        return RATES.includes(v) ? v : 1;
    } catch {
        return 1;
    }
}

export default function VoicePlayer({ src, isOwn }) {
    const audioRef = useRef(null);
    const waveformRef = useRef(null);

    const [playing, setPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [current, setCurrent] = useState(0);
    const [error, setError] = useState(false);
    const [rate, setRate] = useState(readStoredRate);

    const [scrubbing, setScrubbing] = useState(false);
    const [scrubPos, setScrubPos] = useState(0);
    const resumeAfterScrubRef = useRef(false);

    const url = resolveUrl(src);
    const bars = useMemo(() => makeBars(url), [url]);

    /* Метаданные и события аудио */
    useEffect(() => {
        const a = audioRef.current;
        if (!a) return;

        const onLoaded = () => {
            let d = a.duration;
            if (!isFinite(d) || d <= 0) {
                /* WebM из MediaRecorder часто имеет duration = Infinity,
                   пока не сделаешь seek. Трюк: прыгаем далеко вперёд,
                   ждём durationchange, сбрасываемся на 0. */
                const onDur = () => {
                    if (isFinite(a.duration) && a.duration > 0) {
                        setDuration(a.duration);
                        try { a.currentTime = 0; } catch {}
                        a.removeEventListener('durationchange', onDur);
                    }
                };
                a.addEventListener('durationchange', onDur);
                try { a.currentTime = 1e7; } catch {}
            } else {
                setDuration(d);
            }
            setError(false);
        };
        const onEnd = () => {
            setPlaying(false);
            setCurrent(0);
            try { a.currentTime = 0; } catch {}
            if (currentlyPlaying === a) currentlyPlaying = null;
        };
        const onErr = () => {
            setError(true);
            setPlaying(false);
        };
        const onPause = () => {
            setPlaying(false);
            if (currentlyPlaying === a) currentlyPlaying = null;
        };
        const onPlay = () => setPlaying(true);

        a.addEventListener('loadedmetadata', onLoaded);
        a.addEventListener('ended', onEnd);
        a.addEventListener('error', onErr);
        a.addEventListener('pause', onPause);
        a.addEventListener('play', onPlay);

        a.playbackRate = rate;

        return () => {
            a.removeEventListener('loadedmetadata', onLoaded);
            a.removeEventListener('ended', onEnd);
            a.removeEventListener('error', onErr);
            a.removeEventListener('pause', onPause);
            a.removeEventListener('play', onPlay);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url]);

    /* Применение скорости + сохранение в localStorage */
    useEffect(() => {
        const a = audioRef.current;
        if (a) a.playbackRate = rate;
        try { localStorage.setItem(RATE_KEY, String(rate)); } catch {}
    }, [rate]);

    /* Плавный прогресс через rAF. timeupdate слишком редко (4 Гц) —
       полоска бы дёргалась. */
    useEffect(() => {
        if (!playing || scrubbing) return;
        let raf;
        const tick = () => {
            const a = audioRef.current;
            if (a) setCurrent(a.currentTime || 0);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [playing, scrubbing]);

    /* Останавливаем при размонтировании */
    useEffect(() => {
        return () => {
            const a = audioRef.current;
            if (a) {
                try { a.pause(); } catch {}
                if (currentlyPlaying === a) currentlyPlaying = null;
            }
        };
    }, []);

    const toggle = () => {
        const a = audioRef.current;
        if (!a) return;
        if (error) {
            window.open(url, '_blank');
            return;
        }
        if (playing) {
            a.pause();
            return;
        }
        // Автопауза предыдущего плеера
        if (currentlyPlaying && currentlyPlaying !== a) {
            try { currentlyPlaying.pause(); } catch {}
        }
        currentlyPlaying = a;
        a.play().catch((e) => {
            console.warn('play failed', e);
            setError(true);
        });
    };

    const cycleRate = () => {
        const i = RATES.indexOf(rate);
        setRate(RATES[(i + 1) % RATES.length]);
    };

    /* ─── Свайп-перемотка по waveform ─── */

    const posFromClientX = (clientX) => {
        const el = waveformRef.current;
        if (!el) return 0;
        const rect = el.getBoundingClientRect();
        const x = clientX - rect.left;
        return Math.max(0, Math.min(1, x / rect.width));
    };

    const onPointerDown = (e) => {
        if (duration <= 0) return;
        e.stopPropagation();
        e.preventDefault();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}

        const a = audioRef.current;
        // Запоминаем, играло ли, чтобы возобновить после скраба
        resumeAfterScrubRef.current = !!(a && !a.paused);
        if (resumeAfterScrubRef.current) {
            try { a.pause(); } catch {}
        }

        setScrubbing(true);
        setScrubPos(posFromClientX(e.clientX));
    };

    const onPointerMove = (e) => {
        if (!scrubbing) return;
        e.stopPropagation();
        setScrubPos(posFromClientX(e.clientX));
    };

    const onPointerUp = (e) => {
        if (!scrubbing) return;
        e.stopPropagation();

        const a = audioRef.current;
        if (a && duration > 0) {
            const t = scrubPos * duration;
            try { a.currentTime = t; } catch {}
            setCurrent(t);
            if (resumeAfterScrubRef.current) {
                if (currentlyPlaying && currentlyPlaying !== a) {
                    try { currentlyPlaying.pause(); } catch {}
                }
                currentlyPlaying = a;
                a.play().catch(() => {});
            }
        }

        setScrubbing(false);
        resumeAfterScrubRef.current = false;
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    };

    const onPointerCancel = () => {
        setScrubbing(false);
        resumeAfterScrubRef.current = false;
    };

    const progress = scrubbing
        ? scrubPos
        : duration > 0
            ? Math.min(1, current / duration)
            : 0;

    const displayTime = scrubbing && duration > 0
        ? scrubPos * duration
        : current;

    const activeBar = isOwn ? 'rgba(255,255,255,0.95)' : 'var(--brand-accent-1, #7C3AED)';
    const dimBar = isOwn ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.18)';

    return (
        <div
            className={`flex items-center gap-2.5 min-w-[220px] max-w-[320px] rounded-2xl px-3 py-2 select-none ${
                isOwn ? 'bg-black/20' : 'bg-white/10'
            }`}
        >
            <audio
                ref={audioRef}
                src={url}
                preload="metadata"
                crossOrigin="anonymous"
            />

            <button
                type="button"
                onClick={toggle}
                className={`w-9 h-9 shrink-0 grid place-items-center rounded-full transition active:scale-95 ${
                    isOwn ? 'bg-white/25 text-white' : 'bg-white/15 text-white'
                }`}
                title={error ? 'Открыть файл' : playing ? 'Пауза' : 'Воспроизвести'}
                aria-label={playing ? 'Пауза' : 'Воспроизвести'}
            >
                {error ? (
                    <span className="text-base">⬇</span>
                ) : playing ? (
                    <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true">
                        <rect x="0" y="0" width="4" height="14" rx="1" />
                        <rect x="8" y="0" width="4" height="14" rx="1" />
                    </svg>
                ) : (
                    <svg width="13" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true">
                        <path d="M1 1.2v11.6a1 1 0 0 0 1.5.87l10-5.8a1 1 0 0 0 0-1.74l-10-5.8A1 1 0 0 0 1 1.2Z" />
                    </svg>
                )}
            </button>

            {/* Waveform + время */}
            <div className="flex-1 min-w-0">
                <div
                    ref={waveformRef}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerCancel}
                    className="flex items-center gap-[2px] h-6 cursor-pointer touch-none"
                >
                    {bars.map((h, i) => {
                        const left = i / bars.length;
                        const active = left <= progress;
                        return (
                            <div
                                key={i}
                                className="flex-1 rounded-full transition-colors duration-75"
                                style={{
                                    height: `${Math.max(3, h * 24)}px`,
                                    background: active ? activeBar : dimBar,
                                }}
                            />
                        );
                    })}
                </div>

                <div className="flex justify-between text-[10px] mt-0.5 tabular-nums opacity-70 leading-none">
                    <span>{error ? 'ошибка' : fmtTime(displayTime)}</span>
                    <span>{error ? '' : fmtTime(duration)}</span>
                </div>
            </div>

            {/* Скорость воспроизведения */}
            <button
                type="button"
                onClick={cycleRate}
                className={`shrink-0 min-w-[34px] h-7 px-1.5 rounded-full text-[11px] font-bold transition active:scale-95 ${
                    rate === 1
                        ? 'bg-white/10 text-white/70 hover:bg-white/15'
                        : 'bg-white/25 text-white'
                }`}
                title="Скорость воспроизведения"
                aria-label={`Скорость ${rate}x`}
            >
                {rate}x
            </button>
        </div>
    );
}