import { TAB_GROUPS } from '../constants.js';

export default function AdminSidebar({ tab, onSelect, badges = {} }) {
    return (
        <nav className="flex flex-col gap-5">
            {TAB_GROUPS.map((group) => (
                <div key={group.key}>
                    <div className="px-3 mb-1 text-[10px] uppercase tracking-wider text-white/30 font-semibold">
                        {group.label}
                    </div>
                    <div className="space-y-0.5">
                        {group.tabs.map(([key, label, icon]) => {
                            const badge = badges[key];
                            const active = tab === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => onSelect(key)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-sm transition ${
                                        active
                                            ? 'bg-violet/20 text-white font-semibold'
                                            : 'text-white/60 hover:bg-white/5 hover:text-white'
                                    }`}
                                >
                                    <span className="text-lg shrink-0">{icon}</span>
                                    <span className="flex-1 truncate">{label}</span>
                                    {badge > 0 && (
                                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-pink text-white text-[10px] font-bold grid place-items-center">
                                            {badge > 99 ? '99+' : badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </nav>
    );
}