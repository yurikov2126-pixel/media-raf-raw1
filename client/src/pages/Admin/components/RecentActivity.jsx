import Avatar from '../../../components/Avatar.jsx';

function fmtTime(s) {
    if (!s) return '';
    const d = new Date(s);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'только что';
    if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
    return d.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function RecentActivity({ items = [], onOpenAll }) {
    return (
        <div className="card p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
                <div className="font-bold text-lg">📜 Последние действия</div>
                {onOpenAll && (
                    <button
                        onClick={onOpenAll}
                        className="text-xs text-violet-soft hover:underline shrink-0"
                    >
                        Все →
                    </button>
                )}
            </div>
            {items.length === 0 ? (
                <div className="text-center text-white/40 py-6 text-sm">
                    Пока пусто
                </div>
            ) : (
                <div className="space-y-0">
                    {items.map((it) => (
                        <div
                            key={it.id}
                            className="flex items-center gap-3 py-2 border-b border-white/5 last:border-b-0"
                        >
                            {it.admin ? (
                                <Avatar user={it.admin} size={24} />
                            ) : (
                                <div className="w-6 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="text-xs text-white/80 truncate">
                                    <span className="font-medium">
                                        {it.admin?.fullName || 'Система'}
                                    </span>{' '}
                                    <span className="text-white/30">·</span>{' '}
                                    <span className="font-mono text-violet-soft">
                                        {it.action}
                                    </span>
                                </div>
                                <div className="text-[10px] text-white/40">
                                    {fmtTime(it.createdAt)}
                                    {it.affected > 0 && ` · затронуто: ${it.affected}`}
                                </div>
                            </div>
                            {it.error && (
                                <span className="chip bg-pink/20 text-pink text-[10px] shrink-0">
                                    ошибка
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}