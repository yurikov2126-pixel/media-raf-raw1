import React from 'react';

const PALETTES = {
    violet: ['#7C3AED', '#C084FC'],
    pink:   ['#EC4899', '#F9A8D4'],
    cyan:   ['#06B6D4', '#67E8F9'],
    lime:   ['#65A30D', '#BEF264'],
    orange: ['#F97316', '#FDBA74'],
};

/* SVG-«иллюстрации» — набор фигур, не эмодзи.
   Каждая функция получает текущие цвета палитры. */
const ILLUSTRATIONS = {
    // Камера
    camera: (c1, c2) => (
        <g>
            <rect x="24" y="46" width="72" height="44" rx="8" fill="#fff" opacity="0.9" />
            <rect x="32" y="38" width="20" height="10" rx="3" fill="#fff" opacity="0.9" />
            <circle cx="60" cy="68" r="16" fill={c1} />
            <circle cx="60" cy="68" r="9" fill="#1a1a1a" />
            <circle cx="60" cy="68" r="4" fill="#fff" opacity="0.7" />
            <circle cx="86" cy="54" r="3" fill={c1} />
        </g>
    ),
    // Микрофон
    mic: (c1, c2) => (
        <g>
            <rect x="50" y="22" width="20" height="42" rx="10" fill="#fff" opacity="0.9" />
            <path d="M40 58 Q60 82 80 58" stroke="#fff" strokeWidth="3" fill="none" opacity="0.9" />
            <rect x="58" y="80" width="4" height="14" fill="#fff" opacity="0.9" />
            <rect x="48" y="94" width="24" height="4" rx="2" fill="#fff" opacity="0.9" />
        </g>
    ),
    // Хлопушка
    clapper: (c1, c2) => (
        <g>
            <rect x="20" y="50" width="80" height="40" rx="6" fill="#fff" opacity="0.9" />
            <rect x="20" y="38" width="80" height="14" rx="3" fill="#1a1a1a" />
            <rect x="26" y="38" width="10" height="14" fill="#fff" opacity="0.9" transform="skewX(-20)" />
            <rect x="46" y="38" width="10" height="14" fill="#fff" opacity="0.9" transform="skewX(-20)" />
            <rect x="66" y="38" width="10" height="14" fill="#fff" opacity="0.9" transform="skewX(-20)" />
            <rect x="30" y="62" width="60" height="4" rx="2" fill={c1} />
            <rect x="30" y="72" width="40" height="4" rx="2" fill={c1} />
        </g>
    ),
    // Лампа
    lamp: (c1, c2) => (
        <g>
            <path d="M40 40 L80 40 L74 68 L46 68 Z" fill="#fff" opacity="0.9" />
            <circle cx="60" cy="66" r="6" fill={c2} />
            <rect x="56" y="68" width="8" height="4" fill={c1} />
            <line x1="60" y1="22" x2="60" y2="40" stroke="#fff" strokeWidth="3" opacity="0.9" />
            <line x1="38" y1="30" x2="48" y2="36" stroke="#fff" strokeWidth="2" opacity="0.6" />
            <line x1="82" y1="30" x2="72" y2="36" stroke="#fff" strokeWidth="2" opacity="0.6" />
        </g>
    ),
    // Радио-волны
    radio: (c1, c2) => (
        <g>
            <circle cx="60" cy="60" r="8" fill="#fff" opacity="0.9" />
            <path d="M42 42 Q30 60 42 78" stroke="#fff" strokeWidth="3" fill="none" opacity="0.7" />
            <path d="M78 42 Q90 60 78 78" stroke="#fff" strokeWidth="3" fill="none" opacity="0.7" />
            <path d="M30 30 Q10 60 30 90" stroke="#fff" strokeWidth="3" fill="none" opacity="0.4" />
            <path d="M90 30 Q110 60 90 90" stroke="#fff" strokeWidth="3" fill="none" opacity="0.4" />
        </g>
    ),
    // Нота/эквалайзер
    mixer: (c1, c2) => (
        <g>
            <rect x="30" y="24" width="6" height="72" rx="3" fill="#fff" opacity="0.9" />
            <rect x="48" y="24" width="6" height="72" rx="3" fill="#fff" opacity="0.9" />
            <rect x="66" y="24" width="6" height="72" rx="3" fill="#fff" opacity="0.9" />
            <rect x="84" y="24" width="6" height="72" rx="3" fill="#fff" opacity="0.9" />
            <circle cx="33" cy="50" r="6" fill={c1} />
            <circle cx="51" cy="72" r="6" fill={c1} />
            <circle cx="69" cy="40" r="6" fill={c1} />
            <circle cx="87" cy="66" r="6" fill={c1} />
        </g>
    ),
    // Плёнка
    film: (c1, c2) => (
        <g>
            <rect x="20" y="30" width="80" height="60" rx="4" fill="#fff" opacity="0.9" />
            <rect x="24" y="34" width="6" height="52" fill="#1a1a1a" />
            <rect x="90" y="34" width="6" height="52" fill="#1a1a1a" />
            {[38, 52, 66, 80].map((y) => (
                <g key={y}>
                    <rect x="24" y={y - 4} width="6" height="6" fill={c1} />
                    <rect x="90" y={y - 4} width="6" height="6" fill={c1} />
                </g>
            ))}
        </g>
    ),
    // Кофе
    coffee: (c1, c2) => (
        <g>
            <path d="M32 44 L88 44 L82 88 L38 88 Z" fill="#fff" opacity="0.9" />
            <path d="M88 54 Q98 54 98 64 Q98 74 88 74" stroke="#fff" strokeWidth="4" fill="none" opacity="0.9" />
            <rect x="32" y="44" width="56" height="6" fill={c1} />
            <line x1="46" y1="26" x2="46" y2="38" stroke="#fff" strokeWidth="2" opacity="0.6" />
            <line x1="60" y1="22" x2="60" y2="38" stroke="#fff" strokeWidth="2" opacity="0.6" />
            <line x1="74" y1="26" x2="74" y2="38" stroke="#fff" strokeWidth="2" opacity="0.6" />
        </g>
    ),
    // Огонь
    fire: (c1, c2) => (
        <g>
            <path d="M60 22 Q46 48 52 60 Q48 54 40 62 Q34 74 46 86 Q60 96 74 86 Q86 74 80 62 Q72 54 68 60 Q74 48 60 22 Z"
                  fill="#fff" opacity="0.9" />
            <path d="M60 40 Q54 56 58 62 Q60 66 64 62 Q68 54 60 40 Z" fill={c1} />
        </g>
    ),
    // Сердце
    heart: (c1, c2) => (
        <g>
            <path d="M60 88 C24 62 20 40 36 30 C48 22 56 32 60 42 C64 32 72 22 84 30 C100 40 96 62 60 88 Z"
                  fill="#fff" opacity="0.9" />
            <path d="M40 44 Q46 42 48 48" stroke={c1} strokeWidth="2" fill="none" />
        </g>
    ),
    // Кубок
    cup: (c1, c2) => (
        <g>
            <path d="M38 34 L82 34 L78 66 Q60 78 42 66 Z" fill="#fff" opacity="0.9" />
            <path d="M38 40 Q26 44 30 56 Q34 66 44 68" stroke="#fff" strokeWidth="4" fill="none" opacity="0.9" />
            <path d="M82 40 Q94 44 90 56 Q86 66 76 68" stroke="#fff" strokeWidth="4" fill="none" opacity="0.9" />
            <rect x="56" y="76" width="8" height="8" fill="#fff" opacity="0.9" />
            <rect x="46" y="84" width="28" height="6" rx="2" fill="#fff" opacity="0.9" />
            <circle cx="60" cy="52" r="4" fill={c1} />
        </g>
    ),
    // Маскот «Раф» — кот с камерой
    mascot: (c1, c2) => (
        <g>
            {/* уши */}
            <path d="M36 34 L40 18 L54 30 Z" fill="#fff" opacity="0.9" />
            <path d="M84 34 L80 18 L66 30 Z" fill="#fff" opacity="0.9" />
            {/* голова */}
            <ellipse cx="60" cy="52" rx="30" ry="26" fill="#fff" opacity="0.9" />
            {/* глаза */}
            <ellipse cx="50" cy="50" rx="3" ry="4" fill="#1a1a1a" />
            <ellipse cx="70" cy="50" rx="3" ry="4" fill="#1a1a1a" />
            {/* нос/рот */}
            <path d="M56 60 L60 64 L64 60" stroke="#1a1a1a" strokeWidth="2" fill="none" />
            {/* лапка с камерой */}
            <rect x="46" y="86" width="28" height="16" rx="4" fill="#1a1a1a" />
            <circle cx="60" cy="94" r="5" fill={c1} />
            <circle cx="60" cy="94" r="2" fill="#fff" opacity="0.7" />
        </g>
    ),
};

export const STICKERS = [
    { id: 'camera',   text: 'Чик!',           color: 'violet', ill: 'camera' },
    { id: 'mic',      text: 'На записи',      color: 'pink',   ill: 'mic' },
    { id: 'clapper',  text: 'Мотор!',         color: 'pink',   ill: 'clapper' },
    { id: 'light',    text: 'Свет!',          color: 'orange', ill: 'lamp' },
    { id: 'radio',    text: 'Мы в эфире',     color: 'cyan',   ill: 'radio' },
    { id: 'mix',      text: 'Микс готов',     color: 'lime',   ill: 'mixer' },
    { id: 'film',     text: 'Плёнка жива',    color: 'orange', ill: 'film' },
    { id: 'coffee',   text: 'Кофе и монтаж',  color: 'orange', ill: 'coffee' },
    { id: 'fire',     text: 'Огонь кадр!',    color: 'orange', ill: 'fire' },
    { id: 'love',     text: 'Люблю медиа',    color: 'violet', ill: 'heart' },
    { id: 'top',      text: 'Топ контент',    color: 'lime',   ill: 'cup' },
    { id: 'mascot',   text: 'Раф привет!',    color: 'violet', ill: 'mascot' },
    // дубли с другими палитрами для разнообразия
    { id: 'camera2',  text: 'В фокусе',       color: 'cyan',   ill: 'camera' },
    { id: 'mic2',     text: 'Тишина',         color: 'violet', ill: 'mic' },
    { id: 'clapper2', text: 'Дубль N',        color: 'lime',   ill: 'clapper' },
    { id: 'light2',   text: 'Пересвет!',      color: 'pink',   ill: 'lamp' },
    { id: 'radio2',   text: 'Прямой эфир',    color: 'pink',   ill: 'radio' },
    { id: 'mix2',     text: 'Дроп',           color: 'cyan',   ill: 'mixer' },
    { id: 'film2',    text: 'В цвете',        color: 'violet', ill: 'film' },
    { id: 'fire2',    text: 'Хайп',           color: 'pink',   ill: 'fire' },
    { id: 'love2',    text: 'Респект',        color: 'pink',   ill: 'heart' },
    { id: 'top2',     text: 'Премьера',       color: 'orange', ill: 'cup' },
    { id: 'mascot2',  text: 'Уважение',       color: 'cyan',   ill: 'mascot' },
    { id: 'fire3',    text: 'Дедлайн 🔥',     color: 'violet', ill: 'fire' },
];

export function Sticker({ id, size = 140, className = '' }) {
    const s = STICKERS.find((x) => x.id === id);
    if (!s) return null;

    const [c1, c2] = PALETTES[s.color];
    const gid = `g-${s.id}`;
    const fid = `f-${s.id}`;
    const fontSize = s.text.length > 12 ? 9 : s.text.length > 8 ? 10 : 11;
    const Ill = ILLUSTRATIONS[s.ill] || ILLUSTRATIONS.camera;

    return (
        <svg
            width={size} height={size} viewBox="0 0 120 120"
            className={className}
            style={{ display: 'block' }}
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={c1} />
                    <stop offset="100%" stopColor={c2} />
                </linearGradient>
                <filter id={fid} x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.35" />
                </filter>
            </defs>

            <path
                d="M60 4c22 0 44 14 48 36s-6 46-24 56-46 10-64-2S-6 60 8 40 38 4 60 4z"
                fill={`url(#${gid})`}
            />

            <g filter={`url(#${fid})`}>{Ill(c1, c2)}</g>

            <g filter={`url(#${fid})`}>
                <rect x="14" y="98" width="92" height="18" rx="9" fill="rgba(0,0,0,0.6)" />
            </g>

            <text
                x="60" y="110" textAnchor="middle"
                fontSize={fontSize} fontWeight="900" fill="#ffffff"
                style={{
                    letterSpacing: '0.4px',
                    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
                    pointerEvents: 'none',
                }}
            >
                {s.text}
            </text>
        </svg>
    );
}

export const QUICK_EMOJI = ['❤️','🔥','😂','👍','🤯','😍','🎬','🎙️','📸','⭐','💜','🫡'];