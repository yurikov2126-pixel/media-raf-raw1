import { NavLink, Outlet } from 'react-router-dom';

const SECTIONS = [
    ['','Обзор'], ['projects','Проекты'], ['calendar','Календарь'],
    ['files','Файлы'], ['shares','Общий доступ'], ['reviews','На проверке'],
    ['ideas','Идеи'], ['content','Контент-план'],
];

export default function Editorial() {
    return (
        <section className="mx-auto max-w-7xl px-4 py-6 md:px-8" aria-label="Редакция">
            <header className="mb-6">
                <p className="text-sm opacity-60">MEDIA·RAF·RAW / Рабочее пространство</p>
                <h1 className="mt-1 text-3xl font-semibold">Редакция</h1>
                <p className="mt-2 text-sm opacity-70">Проекты, материалы и редакционные процессы в одном месте.</p>
            </header>
            <nav aria-label="Разделы редакции" className="mb-6 flex gap-2 overflow-x-auto pb-2" data-no-route-swipe>
                {SECTIONS.map(([path, label]) => (
                    <NavLink key={path} end={!path} to={path || '/app/editorial'}
                        className={({isActive}) => `shrink-0 rounded-xl border px-3 py-2 text-sm transition-colors ${isActive ? 'border-current font-semibold' : 'border-current/20 opacity-70 hover:opacity-100'}`}>
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
        <div className="rounded-2xl border border-current/15 p-6 md:p-8">
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm opacity-65">Раздел готовится. Данные и действия появятся на следующем этапе разработки.</p>
        </div>
    );
}
