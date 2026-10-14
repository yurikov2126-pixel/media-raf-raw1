import { AcademyPulseWidget, ProductionPulseWidget, EditorialCalendarWidget, CertificatesShowcaseWidget } from '../components/DashboardInteractiveWidgets.jsx';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import { useModules } from '../store/modules.jsx';
import { useGamification } from '../store/gamification.jsx';
import WikimediaDiscovery from '../components/WikimediaDiscovery.jsx';
import UpcomingEditorialTasks from '../components/UpcomingEditorialTasks.jsx';
import XpProgressBar from '../components/XpProgressBar.jsx';
import usePageMeta from '../hooks/usePageMeta.js';

const META = {
    learning: { title:'Продолжить обучение', description:'Текущий курс и следующий шаг' },
    tasks: { title:'Ближайшие задания', description:'Работа редакции и дедлайны', module:'editorial' },
    wiki: { title:'ВикиМедиа', description:'Случайная статья из нашей базы знаний', module:'wiki' },
    progress: { title:'Мой прогресс', description:'Уровень и XP' },
    quickActions: { title:'Быстрые действия', description:'Частые разделы платформы' },
    profile: { title:'Мой профиль', description:'Достижения и портфолио' },
    feed: { title:'Лента команды', description:'Последние публикации', module:'feed' },
};
const DEFAULT = ['learning','tasks','wiki','progress','quickActions'];

export default function Dashboard2() {
    const { user, token } = useAuth();
    const { isEnabled } = useModules();
    const gamif = useGamification();
    const [widgets, setWidgets] = useState(DEFAULT);
    const [catalog, setCatalog] = useState([]);
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [courses, setCourses] = useState([]);
    const [posts, setPosts] = useState([]);

    usePageMeta({ title:'Главная · Dashboard 2.0', description:'Персональная главная Media_РАФ_RAW' });
    useEffect(() => {
        let active = true; setLoading(true); setError('');
        api('/dashboard-preferences', {token})
            .then(data => {if(active){setWidgets(data.widgets || DEFAULT);setCatalog(data.catalog || []);}})
            .catch(e => {if(active)setError(e.message || 'Настройки недоступны');})
            .finally(() => {if(active)setLoading(false);});
        return () => {active=false;};
    }, [token, user?.id]);
    useEffect(() => {
        if (!token || !isEnabled('courses')) return;
        let live = true;
        api('/courses', {token}).then(data=>{if(live)setCourses(data || []);}).catch(()=>{});
        return () => {live=false;};
    }, [token, isEnabled]);
    useEffect(() => {
        if (!token || !widgets.includes('feed') || !isEnabled('feed')) return;
        let live = true;
        api('/posts/feed?limit=3', {token}).then(data=>{if(live)setPosts(data?.items||[]);}).catch(()=>{});
        return () => {live=false;};
    }, [token, widgets.includes('feed'), isEnabled]);
    const catalogMap = useMemo(() => new Map(catalog.map(w => [w.key,w])), [catalog]);
    const available = useMemo(() => catalog.filter(w=>w.enabled!==false&&(!w.module||isEnabled(w.module))), [catalog,isEnabled]);
    const visible = widgets.filter(k => catalogMap.has(k) && (!catalogMap.get(k).module || isEnabled(catalogMap.get(k).module)));
    const save = async next => {
        const previous = widgets;
        setWidgets(next); setSaving(true);setError('');
        try {await api('/dashboard-preferences', {token,method:'PUT',body:{widgets:next}});}
        catch(e) {setWidgets(previous);setError(e.message || 'Не удалось сохранить настройки');}
        finally {setSaving(false);}
    };
    const toggle = key => save(widgets.includes(key) ? widgets.filter(k=>k!==key) : [...widgets,key]);
    const move = (key,direction) => {
        const index=widgets.indexOf(key), target=index+direction;
        if (target<0||target>=widgets.length)return;
        const next=[...widgets];[next[index],next[target]]=[next[target],next[index]];save(next);
    };
    const activeCourses=courses.filter(c=>c.enrolled&&!c.completed&&!c.certified).sort((a,b)=>(b.progress||0)-(a.progress||0));
    const course=activeCourses[0];
    const courseUrl=course?'/app/courses/'+encodeURIComponent(course.slug)+(course.resumeLessonOrder?'?lesson='+course.resumeLessonOrder:''):'/app/courses';

    const render = key => {
        const widget = catalogMap.get(key);
        if (widget?.kind === 'text') return <section className="ui-section"><div className="ui-card2">
            <div className="ui-card2__title">{widget.title}</div>
            <p className="text-sm opacity-75 mt-3 leading-relaxed whitespace-pre-wrap break-words">{widget.content}</p>
        </div></section>;
        if (widget?.kind === 'link') return <section className="ui-section"><div className="ui-card2">
            <div className="ui-card2__title">{widget.title}</div>
            <p className="text-sm opacity-70 mt-2 break-words">{widget.content || widget.description}</p>
            <Link to={widget.url || '/app'} className="ui-action mt-4"><span className="ui-action__copy">
                <span className="ui-action__title">Открыть раздел</span></span><span>→</span></Link>
        </div></section>;
        switch(key) {
            case 'tasks': return <UpcomingEditorialTasks />;
            case 'wiki': return <WikimediaDiscovery />;
            case 'learning': return <section className="ui-section"><div className="ui-card2">
                <div className="ui-card2__title">Продолжить обучение</div>
                <div className="ui-card2__muted mt-1">{course ? 'Текущий курс' : 'Выбери новый курс в Академии'}</div>
                <Link to={courseUrl} className="ui-action mt-4">
                    <span className="ui-action__icon">📚</span>
                    <span className="ui-action__copy">
                        <span className="ui-action__title">{course?.title || 'Выбрать курс'}</span>
                        <span className="ui-action__sub">{course ? 'Прогресс '+(course.progress||0)+'%' : 'Начни обучение'}</span>
                    </span><span aria-hidden="true">→</span>
                </Link>
                {course && <div className="ui-course-progress mt-3"><span style={{width:Math.max(0,Math.min(100,course.progress||0))+'%'}} /></div>}
            </div></section>;
            case 'progress': return <section className="ui-section"><div className="ui-card2">
                <div className="ui-card2__title">Мой прогресс</div>
                {gamif.enabled && gamif.stats ? <>
                    <div className="text-2xl font-bold mt-4">{gamif.stats.xp} XP</div>
                    <div className="ui-card2__muted mb-3">Уровень {gamif.stats.level}</div>
                    <XpProgressBar progress={gamif.progress}/>
                    <Link className="ui-section-link mt-3" to="/app/leaderboard">Открыть рейтинг →</Link>
                </> : <p className="mt-3 text-sm opacity-65">Прогресс станет доступен после включения достижений.</p>}
            </div></section>;
            case 'quickActions': return <section className="ui-section"><div className="ui-card2">
                <div className="ui-card2__title mb-4">Быстрые действия</div>
                <div className="grid gap-2 sm:grid-cols-2">
                    {[[ '👥','Редакция','/app/editorial','editorial'],['💬','Чаты','/app/chats','chats'],['📖','Академия','/app/academy/me','courses'],['📝','Лента','/app/feed','feed']]
                        .filter(x=>isEnabled(x[3])).map(([icon,label,to])=>
                            <Link key={label} to={to} className="ui-action"><span className="ui-action__icon">{icon}</span><span className="ui-action__copy"><span className="ui-action__title">{label}</span></span><span>→</span></Link>)}
                </div>
            </div></section>;
            case 'profile': return <section className="ui-section"><div className="ui-card2">
                <div className="ui-card2__title">Мой профиль</div>
                <p className="text-sm opacity-65 mt-2">Портфолио, компетенции, награды и достижения.</p>
                <Link className="ui-action mt-4" to={'/app/u/'+encodeURIComponent(user.username)}>
                    <span className="ui-action__icon">👤</span><span className="ui-action__copy"><span className="ui-action__title">Открыть профиль</span></span><span>→</span>
                </Link>
            </div></section>;
            case 'certificates': return <CertificatesShowcaseWidget />;
            case 'academy': return <AcademyPulseWidget />;
            case 'production': return <ProductionPulseWidget />;
            case 'calendar': return <EditorialCalendarWidget />;
            case 'feed': return <section className="ui-section"><div className="ui-card2 space-y-3">
                <div className="ui-card2__title">Лента команды</div>
                {posts.length ? posts.map(post=><Link key={post.id} to={'/app/feed?post='+encodeURIComponent(post.id)}
                    className="block border-t border-white/10 pt-3">
                    <span className="block font-semibold text-sm">{post.author?.fullName||'Участник'}</span>
                    <span className="text-sm opacity-75 line-clamp-3 break-words">{post.content||'Новая публикация'}</span>
                </Link>):<p className="text-sm opacity-65">Публикаций пока нет.</p>}
                <Link to="/app/feed" className="ui-section-link">Вся лента →</Link>
            </div></section>;
            default:return null;
        }
    };
    return <div className="ui-page space-y-4">
        <header className="flex flex-wrap gap-3 items-center justify-between rounded-2xl border border-violet-400/20 p-4 sm:p-6">
            <div><p className="text-xs uppercase tracking-widest text-violet-soft">Media_РАФ_RAW · Dashboard 2.0</p>
                <h1 className="text-2xl sm:text-3xl font-bold mt-1">Моё пространство</h1>
                <p className="text-sm opacity-65 mt-1">Настрой главную под свои задачи.</p></div>
            <button type="button" aria-expanded={editing} className="btn-primary min-h-11"
                onClick={()=>setEditing(v=>!v)}>⚙ {editing?'Готово':'Настроить дашборд'}</button>
        </header>
        {error && <p role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
        {loading ? <p className="text-sm opacity-65 p-5" role="status">Загружаем твои настройки…</p> : <>
            {editing && <section className="rounded-2xl border border-violet-400/30 bg-violet-400/5 p-4 space-y-3" aria-label="Настройки виджетов">
                <div className="font-semibold">Мои виджеты</div>
                <p className="text-sm opacity-65">Добавляй, скрывай и перемещай блоки. Порядок сохраняется в твоём профиле и действует на всех устройствах.</p>
                <div className="grid gap-2 sm:grid-cols-2">{available.map(m=>{const key=m.key;return <div key={key} className="rounded-xl border border-white/10 p-3 flex items-center gap-2">
                    <label className="min-w-0 flex-1 flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={widgets.includes(key)} disabled={saving} onChange={()=>toggle(key)} />
                        <span className="min-w-0"><strong className="block">{m.title}</strong><span className="block opacity-60 text-xs">{m.description}</span></span>
                    </label>
                    {widgets.includes(key) && <div className="flex gap-1 shrink-0">
                        <button type="button" aria-label={'Поднять '+m.title} disabled={saving || widgets.indexOf(key)===0} className="btn-ghost min-w-9 min-h-9" onClick={()=>move(key,-1)}>↑</button>
                        <button type="button" aria-label={'Опустить '+m.title} disabled={saving || widgets.indexOf(key)===widgets.length-1} className="btn-ghost min-w-9 min-h-9" onClick={()=>move(key,1)}>↓</button>
                    </div>}
                </div>;})}</div>
                <div className="flex gap-3 items-center flex-wrap">
                    <button className="btn-ghost text-sm" type="button" disabled={saving} onClick={()=>save(DEFAULT.filter(key => available.some(widget => widget.key === key)))}>Восстановить по умолчанию</button>
                    {saving && <span role="status" className="text-xs opacity-65">Сохраняем…</span>}
                </div>
            </section>}
            {visible.length === 0 && <section className="ui-card2"><p className="text-sm opacity-70">Здесь пока нет виджетов. Открой настройки и добавь нужные блоки.</p></section>}
            <div className="grid lg:grid-cols-2 gap-4 items-start">
                {visible.map(key=><div className={`min-w-0 ${key==='wiki'||key==='tasks'?'lg:col-span-2':''}`} key={key}>
                    {catalogMap.get(key)?.kind === 'builtin' && <div className="mb-2 text-xs text-violet-soft font-medium">{catalogMap.get(key).title}</div>}
                    {render(key)}
                </div>)}
            </div>
        </>}
    </div>;
}
