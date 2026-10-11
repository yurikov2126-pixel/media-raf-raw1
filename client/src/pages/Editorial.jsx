import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

const SECTIONS = [
    ['','Обзор'], ['my-tasks','Мои задания'], ['projects','Проекты'], ['calendar','Календарь'],
    ['files','Файлы'], ['shares','Общий доступ'], ['reviews','На проверке'],
    ['ideas','Идеи'], ['content','Контент-план'],
];

export default function Editorial() {
    const location = useLocation();
    const navigate = useNavigate();
    const { token } = useAuth();
    const [canManageProjects, setCanManageProjects] = useState(false);
    useEffect(() => {
        let active = true;
        setCanManageProjects(false);
        if (token) api('/editorial/workflow/navigation', { token })
            .then(data => { if (active) setCanManageProjects(!!data.canManageProjects); })
            .catch(() => { if (active) setCanManageProjects(false); });
        return () => { active = false; };
    }, [token]);
    const sections = SECTIONS.filter(([path]) => path !== 'projects' || canManageProjects);
    const currentPath = sections.find(([path]) => path
        ? location.pathname.startsWith(`/app/editorial/${path}`)
        : location.pathname === '/app/editorial')?.[0] ?? '';
    const primaryPaths = ['my-tasks', 'projects', 'reviews'];
    const primarySections = sections.filter(([path]) => primaryPaths.includes(path));
    const secondarySections = sections.filter(([path]) => !primaryPaths.includes(path));
    const isSecondaryActive = secondarySections.some(([path]) => path === currentPath);
    const sectionUrl = (path) => path ? `/app/editorial/${path}` : '/app/editorial';
    return (
        <section className="editorial-glass mx-auto max-w-7xl px-3 py-3 sm:px-5 md:py-5" aria-label="Редакция">
            <header className="editorial-glass__header mb-2">
                <p className="text-xs text-slate-600 dark:text-slate-300">MEDIA·RAF·RAW / Рабочее пространство</p>
                <h1 className="mt-1 text-2xl font-semibold text-violet-700 dark:text-violet-100">Редакция</h1>

            </header>
            <nav aria-label="Быстрые разделы редакции" className="editorial-mobile-nav mb-4 sm:hidden" data-no-route-swipe>
                {primarySections.map(([path, label]) => (
                    <NavLink key={path} to={sectionUrl(path)} className={({isActive}) => `flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-xl border px-2 py-2 text-center text-xs font-semibold transition-colors ${isActive ? 'border-violet-600 bg-violet-600 text-white shadow-sm dark:border-violet-300 dark:bg-violet-200 dark:text-slate-950' : 'border-slate-300 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'}`}>{label}</NavLink>
                ))}
                <label className="relative flex min-h-11 min-w-0 flex-1 items-center">
                    <span className="sr-only">Другие разделы редакции</span>
                    <select aria-label="Другие разделы редакции" value={isSecondaryActive ? currentPath : ''} onChange={(event) => navigate(sectionUrl(event.target.value))} className={`min-h-11 w-full appearance-none rounded-xl border px-2 pr-5 text-center text-xs font-semibold ${isSecondaryActive ? 'border-violet-600 bg-violet-600 text-white dark:border-violet-300 dark:bg-violet-200 dark:text-slate-950' : 'border-slate-300 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'}`}>
                        <option value="" disabled>Ещё ▾</option>
                        {secondarySections.map(([path, label]) => <option key={path} value={path}>{label}</option>)}
                    </select>
                </label>
            </nav>
            <nav aria-label="Разделы редакции" className="editorial-workspace-nav editorial-glass__nav mb-4 hidden sm:flex" data-no-route-swipe>
                {sections.map(([path, label]) => (
                    <NavLink key={path} end={!path} to={sectionUrl(path)}
                        className={({isActive}) => `inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'border-violet-600 bg-violet-600 text-white shadow-sm dark:border-violet-300 dark:bg-violet-200 dark:text-slate-950' : 'border-transparent text-slate-700 hover:border-violet-200 hover:bg-violet-50 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800'}`}>
                        {label}
                    </NavLink>
                ))}
            </nav>
            <Outlet />
        </section>
    );
}

export function EditorialSection({ title = 'Обзор' }) {
    return (
        <div className="editorial-glass__surface rounded-2xl border border-current/15 p-6 md:p-8">
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm opacity-65">Раздел готовится. Данные и действия появятся на следующем этапе разработки.</p>
        </div>
    );
}
