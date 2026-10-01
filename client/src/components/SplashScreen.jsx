import { useEffect, useState } from 'react';

/* Момент старта приложения. Фиксируется один раз при загрузке модуля —
   это очень близко к первому кадру PWA и одинаково для всех
   экземпляров хука. */
const APP_START = Date.now();

/* Определяем, запущено ли приложение как установленная PWA
   (иконка на домашнем экране). В обычном браузере — false. */
const isStandalonePWA = () => {
    if (typeof window === 'undefined') return false;
    try {
        return (
            window.matchMedia?.('(display-mode: standalone)').matches ||
            window.navigator.standalone === true // iOS Safari
        );
    } catch {
        return false;
    }
};

/*
 * Хук-гейт для сплеша.
 * Возвращает true, пока нужно показывать сплеш:
 *   - loading === true (идёт проверка /auth/me), ИЛИ
 *   - в PWA ещё не прошла минимальная длительность показа.
 *
 * В обычном браузере minDuration = 0, сплеш только на время loading.
 */
export function useSplashGate(loading, minMsStandalone = 2000) {
    const [timeUp, setTimeUp] = useState(() => {
        const min = isStandalonePWA() ? minMsStandalone : 0;
        return min === 0 || Date.now() - APP_START >= min;
    });

    useEffect(() => {
        if (timeUp) return;
        const min = isStandalonePWA() ? minMsStandalone : 0;
        const remaining = Math.max(0, min - (Date.now() - APP_START));
        if (remaining === 0) {
            setTimeUp(true);
            return;
        }
        const t = window.setTimeout(() => setTimeUp(true), remaining);
        return () => window.clearTimeout(t);
    }, [timeUp, minMsStandalone]);

    return loading || !timeUp;
}

export default function SplashScreen() {
    return (
        <div
            className="mrr-splash"
            role="status"
            aria-live="polite"
            aria-label="Загрузка"
        >
            <div className="mrr-splash__inner">
                <svg
                    viewBox="0 0 512 512"
                    xmlns="http://www.w3.org/2000/svg"
                    className="mrr-splash__logo"
                    aria-hidden="true"
                >
                    <defs>
                        <linearGradient
                            id="mrr-splash-grad"
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="100%"
                        >
                            <stop offset="0%" stopColor="#8B5CF6" />
                            <stop offset="45%" stopColor="#EC4899" />
                            <stop offset="100%" stopColor="#06B6D4" />
                        </linearGradient>
                    </defs>
                    <rect
                        width="512"
                        height="512"
                        rx="120"
                        fill="url(#mrr-splash-grad)"
                    />
                    <text
                        x="256"
                        y="235"
                        textAnchor="middle"
                        fontFamily="'Space Grotesk', system-ui, sans-serif"
                        fontWeight="700"
                        fontSize="120"
                        fill="#ffffff"
                        letterSpacing="2"
                    >
                        MEDIA
                    </text>
                    <text
                        x="256"
                        y="365"
                        textAnchor="middle"
                        fontFamily="'Space Grotesk', system-ui, sans-serif"
                        fontWeight="700"
                        fontSize="100"
                        fill="#ffffff"
                        letterSpacing="1"
                    >
                        RAF-RAW
                    </text>
                </svg>
                <div className="mrr-splash__hint">Загрузка</div>
            </div>
        </div>
    );
}