const TYPE_ICON_FALLBACK = '⭐';

export default function QuestCard({ quest, typeMeta }) {
    const meta = typeMeta?.[quest.type] || {};
    const icon = meta.icon || TYPE_ICON_FALLBACK;

    const percent = quest.target > 0
        ? Math.min(100, Math.round((quest.current / quest.target) * 100))
        : 0;

    return (
        <div
            className={`relative rounded-2xl p-4 transition ${
                quest.completed
                    ? 'bg-lime/10 border border-lime/30'
                    : 'bg-white/5 border border-white/10 hover:bg-white/10'
            }`}
        >
            <div className="flex items-start gap-3 mb-3">
                <div
                    className={`w-12 h-12 rounded-xl grid place-items-center text-2xl shrink-0 ${
                        quest.completed ? '' : ''
                    }`}
                    style={{
                        background: quest.completed
                            ? 'linear-gradient(135deg, #84CC1640 0%, #84CC1620 100%)'
                            : 'rgba(255,255,255,.05)',
                        border: quest.completed
                            ? '1px solid #84CC1680'
                            : '1px solid rgba(255,255,255,.08)',
                    }}
                >
                    {quest.completed ? '✓' : icon}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm leading-tight">
                        {meta.label || quest.type}
                    </div>
                    <div className="text-xs text-white/50 mt-1">
                        Прогресс: {quest.current} / {quest.target}
                    </div>
                </div>
                <div
                    className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-bold ${
                        quest.completed
                            ? 'bg-lime/20 text-lime'
                            : 'bg-violet/20 text-violet-soft'
                    }`}
                >
                    +{quest.xpReward} XP
                </div>
            </div>

            {!quest.completed && (
                <div className="h-1.5 rounded-full overflow-hidden bg-white/5">
                    <div
                        className="h-full transition-all duration-500"
                        style={{
                            width: `${percent}%`,
                            background: 'var(--brand-gradient)',
                        }}
                    />
                </div>
            )}

            {quest.completed && (
                <div className="text-[10px] text-lime">
                    Выполнено {new Date(quest.completedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </div>
            )}
        </div>
    );
}