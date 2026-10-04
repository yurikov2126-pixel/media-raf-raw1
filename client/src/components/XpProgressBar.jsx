export default function XpProgressBar({ progress, className = '' }) {
    if (!progress) return null;

    if (progress.isMax) {
        return (
            <div className={className}>
                <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-pink">Максимальный уровень</span>
                    <span className="text-white/50">100</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-white/10">
                    <div
                        className="h-full"
                        style={{
                            width: '100%',
                            background: 'linear-gradient(90deg, #EC4899, #7C3AED)',
                        }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className={className}>
            <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-white/60">
                    Уровень <b className="text-white">{progress.level}</b>
                </span>
                <span className="text-white/50 tabular-nums">
                    {progress.current} / {progress.needed} XP
                </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-white/10">
                <div
                    className="h-full transition-all duration-500"
                    style={{
                        width: `${progress.percent}%`,
                        background: 'var(--brand-gradient)',
                    }}
                />
            </div>
        </div>
    );
}