import { useState } from 'react';
import { TAB_GROUPS } from '../constants.js';

export default function AdminSidebar({ tab, onSelect, badges = {} }) {
    const [query, setQuery] = useState('');
    const filtered = TAB_GROUPS.map(group => ({
        ...group, tabs: group.tabs.filter(([, label]) => label.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))),
    })).filter(group => group.tabs.length);
    return (
        <nav className="flex flex-col gap-4" aria-label="Разделы администрирования">
            <label className="block px-1">
                <span className="sr-only">Поиск раздела админки</span>
                <input className="input !py-2 !text-sm" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Найти раздел…" />
            </label>
            {filtered.length === 0 && <p className="px-3 text-sm text-slate-500 dark:text-white/50">Разделы не найдены</p>}
            {filtered.map(group => (
                <div key={group.key} className="space-y-1">
                    <div className="px-3 py-1 text-[11px] uppercase tracking-widest text-slate-500 dark:text-white/45 font-semibold">{group.label}</div>
                    <div className="space-y-1">
                        {group.tabs.map(([key, label, icon]) => {
                            const badge = badges[key];
                            const active = tab === key;
                            return (
                                <button key={key} type="button" aria-current={active ? 'page' : undefined} onClick={() => onSelect(key)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet ${active ? 'bg-violet/15 border-violet/40 text-slate-950 dark:text-white font-semibold shadow-sm' : 'border-transparent text-slate-700 hover:bg-slate-200/70 hover:border-slate-300 hover:text-slate-950 dark:text-white/65 dark:hover:bg-white/5 dark:hover:border-white/10 dark:hover:text-white'}`}>
                                    <span className="text-lg shrink-0" aria-hidden="true">{icon}</span>
                                    <span className="flex-1 min-w-0 break-words">{label}</span>
                                    {badge > 0 && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-pink text-white text-[10px] font-bold grid place-items-center">{badge > 99 ? '99+' : badge}</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </nav>
    );
}
