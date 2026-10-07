export default function QuickActions({ onTab }) {
    const actions = [
        { key: 'users', icon: '👥', label: 'Найти пользователя' },
        { key: 'moderation', icon: '🛡️', label: 'Открытые жалобы' },
        { key: 'broadcast', icon: '📢', label: 'Создать рассылку' },
        { key: 'backups', icon: '🗄️', label: 'Сделать бэкап' },
        { key: 'bulk', icon: '🛠', label: 'Пакетные операции' },
        { key: 'actions', icon: '📜', label: 'История действий' },
    ];

    return (
        <div className="card p-5">
            <div className="font-bold text-lg mb-4">⚡ Быстрые действия</div>
            <div className="grid grid-cols-2 gap-2">
                {actions.map((a) => (
                    <button
                        key={a.key}
                        type="button"
                        onClick={() => onTab(a.key)}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition text-left"
                    >
                        <span className="text-2xl shrink-0">{a.icon}</span>
                        <span className="text-sm font-medium">{a.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}