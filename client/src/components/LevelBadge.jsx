import { useGamification } from '../store/gamification.jsx';

/**
 * Компактный значок уровня. Используется рядом с аватаром в профиле,
 * рядом с именем в постах, комментариях, списке чатов.
 *
 * size: 'sm' (18px, только уровень) | 'md' (24px, «Ур. N»)
 */
export default function LevelBadge({ level: levelProp, size = 'sm', title }) {
    const { enabled, stats } = useGamification();
    const level = levelProp ?? stats?.level;

    if (!enabled || !level) return null;

    const color = level >= 20
        ? '#EC4899'
        : level >= 10
            ? '#7C3AED'
            : level >= 5
                ? '#06B6D4'
                : '#94A3B8';

    const sizes = {
        sm: 'min-w-[20px] h-5 text-[10px] px-1',
        md: 'h-6 text-xs px-2',
    };

    return (
        <span
            className={`inline-flex items-center justify-center rounded-full font-bold text-white shrink-0 ${sizes[size]}`}
            style={{
                background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)`,
                boxShadow: `0 0 10px ${color}55`,
            }}
            title={title || `Уровень ${level}`}
        >
            {size === 'md' ? `Ур. ${level}` : level}
        </span>
    );
}