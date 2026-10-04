const RARITY_COLORS = {
    common: '#94A3B8',
    rare: '#06B6D4',
    epic: '#7C3AED',
    legendary: '#EC4899',
};

const RARITY_LABEL = {
    common: 'Обычное',
    rare: 'Редкое',
    epic: 'Эпическое',
    legendary: 'Легендарное',
};

export default function AchievementCard({ achievement }) {
    const color = RARITY_COLORS[achievement.rarity] || RARITY_COLORS.common;
    const unlocked = achievement.unlocked;

    return (
        <div
            className={`relative rounded-2xl p-4 transition ${
                unlocked
                    ? 'bg-white/5 border border-white/10 hover:bg-white/10'
                    : 'bg-white/[0.02] border border-white/5'
            }`}
            title={achievement.description}
        >
            {/* Иконка */}
            <div className="flex items-start gap-3 mb-3">
                <div
                    className={`w-14 h-14 rounded-xl grid place-items-center text-3xl shrink-0 ${
                        unlocked ? '' : 'grayscale opacity-40'
                    }`}
                    style={
                        unlocked
                            ? {
                                background: `linear-gradient(135deg, ${color}30 0%, ${color}15 100%)`,
                                boxShadow: `0 0 20px ${color}30`,
                                border: `1px solid ${color}55`,
                            }
                            : { background: 'rgba(255,255,255,.03)' }
                    }
                >
                    {achievement.icon}
                </div>
                <div className="flex-1 min-w-0">
                    <div className={`font-bold text-sm leading-tight ${unlocked ? '' : 'text-white/40'}`}>
                        {achievement.title}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: unlocked ? color : 'rgba(255,255,255,.3)' }}>
                        {RARITY_LABEL[achievement.rarity]}
                    </div>
                </div>
            </div>

            {/* Описание */}
            <div className={`text-xs leading-relaxed ${unlocked ? 'text-white/60' : 'text-white/30'}`}>
                {achievement.description}
            </div>

            {/* Дата открытия */}
            {unlocked && achievement.unlockedAt && (
                <div className="text-[10px] text-white/30 mt-2">
                    Открыто {new Date(achievement.unlockedAt).toLocaleDateString('ru-RU')}
                </div>
            )}
        </div>
    );
}