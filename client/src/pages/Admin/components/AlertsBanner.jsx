export default function AlertsBanner({ warnings = [] }) {
    if (!warnings.length) return null;
    return (
        <div className="card p-4 border border-pink/30 bg-pink/5">
            <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">⚠️</span>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-pink mb-1">
                        Проблемы со здоровьем сервера
                    </div>
                    <ul className="text-sm text-white/80 space-y-0.5">
                        {warnings.map((w, i) => (
                            <li key={i}>
                                <span className="font-mono text-[10px] text-white/40 uppercase mr-2">
                                    {w.kind}
                                </span>
                                {w.message}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}