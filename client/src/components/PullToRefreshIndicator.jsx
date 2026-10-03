export default function PullToRefreshIndicator({ pull, refreshing, threshold = 70 }) {
    if (!refreshing && pull <= 0) return null;

    const progress = Math.min(1, pull / threshold);
    const ready = pull >= threshold;
    const height = refreshing ? 56 : pull;

    return (
        <div
            className="flex items-center justify-center overflow-hidden transition-[height] duration-150"
            style={{ height }}
        >
            {refreshing ? (
                <div className="flex items-center gap-2 text-sm text-white/60">
                    <span className="inline-block animate-spin">⟳</span>
                    <span>Обновляем…</span>
                </div>
            ) : (
                <div className="flex items-center gap-2 text-sm text-white/60 select-none">
                    <span
                        style={{
                            transform: `rotate(${progress * 180}deg)`,
                            transition: 'transform 80ms linear',
                        }}
                    >
                        ↓
                    </span>
                    <span>{ready ? 'Отпустите для обновления' : 'Потяните вниз'}</span>
                </div>
            )}
        </div>
    );
}