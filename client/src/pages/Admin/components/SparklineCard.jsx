import { ResponsiveContainer, AreaChart, Area } from 'recharts';

export default function SparklineCard({
                                          title,
                                          icon,
                                          data = [],
                                          dataKey = 'value',
                                          color = '#A78BFA',
                                          loading = false,
                                      }) {
    const total = data.reduce((s, d) => s + (d[dataKey] || 0), 0);

    // Сравниваем последние 7 дней с предыдущими 7 (даже если data длиной 30).
    const last7 = data.slice(-7).reduce((s, d) => s + (d[dataKey] || 0), 0);
    const prev7 = data.slice(-14, -7).reduce((s, d) => s + (d[dataKey] || 0), 0);
    const delta = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : null;

    if (loading) {
        return (
            <div className="card p-4 animate-pulse">
                <div className="h-4 w-24 bg-white/5 rounded mb-3" />
                <div className="h-8 w-16 bg-white/5 rounded mb-3" />
                <div className="h-12 bg-white/5 rounded" />
            </div>
        );
    }

    const gradId = `spark-${title.replace(/[^a-z0-9]/gi, '')}`;

    return (
        <div className="card p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-sm text-white/50 flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">{icon}</span>
                    <span className="truncate">{title}</span>
                </div>
                {delta !== null && (
                    <span
                        className={`text-[10px] font-semibold shrink-0 ${
                            delta > 0
                                ? 'text-lime'
                                : delta < 0
                                    ? 'text-pink'
                                    : 'text-white/40'
                        }`}
                    >
                        {delta > 0 ? '↑' : delta < 0 ? '↓' : '—'}{' '}
                        {Math.abs(delta)}%
                    </span>
                )}
            </div>
            <div className="text-3xl font-bold mb-2">{total.toLocaleString('ru-RU')}</div>
            <div style={{ width: '100%', height: 48 }}>
                <ResponsiveContainer>
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={color} stopOpacity={0.6} />
                                <stop offset="100%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Area
                            type="monotone"
                            dataKey={dataKey}
                            stroke={color}
                            strokeWidth={1.5}
                            fill={`url(#${gradId})`}
                            isAnimationActive={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}