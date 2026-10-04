import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGamification } from '../store/gamification.jsx';

const RARITY_COLORS = {
    common: '#94A3B8',
    rare: '#06B6D4',
    epic: '#7C3AED',
    legendary: '#EC4899',
};

const DEDUCTION_LABELS = {
    post_deleted: 'пост удалён',
    comment_deleted: 'комментарий удалён',
    test_failed: 'тест провален',
    report_upheld: 'жалоба подтверждена',
    admin_deduction: 'вычет от администрации',
};

function ToastItem({ item, onDismiss }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        requestAnimationFrame(() => setVisible(true));
        const t = setTimeout(() => {
            setVisible(false);
            setTimeout(() => onDismiss(item.id), 300);
        }, 4500);
        return () => clearTimeout(t);
    }, [item.id, onDismiss]);

    const isLevelUp = item.kind === 'level_up';
    const isDeduct = item.kind === 'deduction';
    const ach = item.achievement;

    const color = isLevelUp
        ? '#EC4899'
        : isDeduct
            ? '#EF4444'
            : (RARITY_COLORS[ach?.rarity] || RARITY_COLORS.common);

    const icon = isLevelUp ? '🎉' : isDeduct ? '⚠️' : ach?.icon;
    const label = isLevelUp ? 'Новый уровень' : isDeduct ? 'Штраф XP' : 'Достижение';

    const title = isLevelUp
        ? `Уровень ${item.level}`
        : isDeduct
            ? `-${item.amount} XP`
            : ach?.title;

    const sub = isDeduct
        ? DEDUCTION_LABELS[item.reason] || item.reason
        : null;

    return (
        <div
            className="relative overflow-hidden rounded-2xl p-4 pr-12 transition-all duration-300"
            style={{
                background: `linear-gradient(135deg, ${color}25 0%, rgba(15,15,24,.95) 60%)`,
                border: `1px solid ${color}55`,
                boxShadow: `0 10px 40px ${color}40`,
                transform: visible ? 'translateX(0) scale(1)' : 'translateX(20px) scale(.95)',
                opacity: visible ? 1 : 0,
                backdropFilter: 'blur(12px)',
            }}
        >
            <div className="flex items-start gap-3">
                <div
                    className="w-12 h-12 shrink-0 rounded-xl grid place-items-center text-2xl"
                    style={{
                        background: `linear-gradient(135deg, ${color}40 0%, ${color}20 100%)`,
                        border: `1px solid ${color}80`,
                    }}
                >
                    {icon}
                </div>
                <div className="min-w-0">
                    <div
                        className="text-[10px] uppercase tracking-widest font-bold"
                        style={{ color }}
                    >
                        {label}
                    </div>
                    <div className="font-bold text-base mt-0.5">{title}</div>
                    {sub && (
                        <div className="text-xs text-white/60 mt-1 line-clamp-2">
                            {sub}
                        </div>
                    )}
                    {!isDeduct && ach?.description && (
                        <div className="text-xs text-white/60 mt-1 line-clamp-2">
                            {ach.description}
                        </div>
                    )}
                </div>
            </div>
            <button
                onClick={() => {
                    setVisible(false);
                    setTimeout(() => onDismiss(item.id), 200);
                }}
                className="absolute top-2 right-2 w-7 h-7 grid place-items-center rounded-full text-white/40 hover:text-white hover:bg-white/10"
                aria-label="Скрыть"
            >
                ✕
            </button>
        </div>
    );
}

export default function AchievementToast() {
    const { toastQueue, dismissToast } = useGamification();
    if (!toastQueue || toastQueue.length === 0) return null;
    const shown = toastQueue.slice(0, 3);

    return createPortal(
        <div className="fixed top-4 right-4 z-[200] w-[320px] max-w-[calc(100vw-32px)] space-y-2 pointer-events-none">
            {shown.map((item) => (
                <div key={item.id} className="pointer-events-auto">
                    <ToastItem item={item} onDismiss={dismissToast} />
                </div>
            ))}
        </div>,
        document.body
    );
}