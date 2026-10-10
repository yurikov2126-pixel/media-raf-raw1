import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

const SECTIONS = [
    ['','Обзор'], ['projects','Проекты'], ['calendar','Календарь'],
    ['files','Файлы'], ['shares','Общий доступ'], ['reviews','На проверке'],
    ['ideas','Идеи'], ['content','Контент-план'],
];

export default function Editorial() {
    const location = useLocation();
    const navigate = useNavigate();
    return (
        <section className="editorial-glass mx-auto max-w-7xl px-3 py-3 sm:px-5 md:py-5" aria-label="Редакция">
            <header className="editorial-glass__header mb-2">
                <p className="text-xs text-slate-600 dark:text-slate-300">MEDIA·RAF·RAW / Рабочее пространство</p>
                <h1 className="mt-1 text-2xl font-semibold text-violet-700 dark:text-violet-100">Редакция</h1>

            </header>
            <div className="mb-3 sm:hidden"><label className="sr-only" htmlFor="editorial-section-picker">Раздел редакции</label><select id="editorial-section-picker" aria-label="Раздел редакции" value={SECTIONS.find(([path]) => (path ? location.pathname.startsWith(`/app/editorial/${path}`) : location.pathname === '/app/editorial'))?.[0] ?? ''} onChange={(event) => navigate(event.target.value ? `/app/editorial/${event.target.value}` : '/app/editorial')} className="w-full rounded-xl border border-current/15 bg-transparent px-3 py-2.5 text-sm font-medium">{SECTIONS.map(([path,label]) => <option key={path} value={path}>{label}</option>)}</select></div>
            <nav aria-label="Разделы редакции" className="editorial-glass__nav mb-4 hidden gap-1.5 overflow-x-auto pb-2 sm:flex" data-no-route-swipe>
                {SECTIONS.map(([path, label]) => (
                    <NavLink key={path} end={!path} to={path || '/app/editorial'}
                        className={({isActive}) => `shrink-0 rounded-lg border px-2.5 py-1.5 text-xs sm:text-sm transition-colors ${isActive ? 'border-violet-500 bg-violet-600 font-semibold text-white shadow-sm dark:border-violet-300 dark:bg-violet-200 dark:text-slate-950' : 'border-slate-300 bg-white text-slate-800 hover:border-violet-500 hover:bg-violet-50 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-violet-300 dark:hover:bg-slate-700'}`}>
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
