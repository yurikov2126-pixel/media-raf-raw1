import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import usePageMeta from '../hooks/usePageMeta.js';

const CATEGORY_LABEL = { photo: '📸 Фото', video: '🎥 Видео', radio: '📻 Радио', sound: '🎚️ Звук' };

export default function Courses() {
    const { token } = useAuth();
    const [courses, setCourses] = useState([]);
    const [filter, setFilter] = useState('all');
    const [view, setView] = useState('academy');

    useEffect(() => { api('/courses', { token }).then(setCourses); }, [token]);

    const enrolled = courses.filter((c) => c.enrolled);
    const continueCourse = enrolled.find((c) => (c.progress ?? 0) < 100) || enrolled[0];
    const shown = filter === 'all' ? courses : courses.filter((c) => c.category === filter);
    const resumeUrl = (c) => `/app/courses/${c.slug}${c.resumeLessonOrder ? `?lesson=${c.resumeLessonOrder}` : ''}`;

    usePageMeta({
        title: 'Академия',
        description: 'Курсы медиацентра: видео, фото, звук, радио. Прокачай скиллы и получи сертификат.',
    });

    return (
        <div className="p-4 sm:p-5 md:p-10 max-w-6xl mx-auto">
            <h1 className="text-3xl md:text-5xl font-bold mb-2">🎓 Академия</h1>
            <p className="text-white/50 mb-6">Выбирай направление, изучай уроки и развивай навыки в медиа</p>

            <div className="flex gap-2 mb-5">
                <button type="button" aria-pressed={view === 'academy'} onClick={() => setView('academy')}
                    className={`chip min-h-11 px-4 ${view === 'academy' ? 'bg-violet text-white' : 'bg-white/10 text-white/75'}`}>Все курсы</button>
                <button type="button" aria-pressed={view === 'mine'} onClick={() => setView('mine')}
                    className={`chip min-h-11 px-4 ${view === 'mine' ? 'bg-violet text-white' : 'bg-white/10 text-white/75'}`}>Моя Академия ({enrolled.length})</button>
            </div>
            {view === 'mine' && (
                <div className="grid grid-cols-3 gap-2 mb-5">
                    <div className="card p-3 text-center"><strong className="block text-xl">{enrolled.length}</strong><span className="text-xs text-white/60">Мои курсы</span></div>
                    <div className="card p-3 text-center"><strong className="block text-xl">{enrolled.filter((c) => c.progress === 100).length}</strong><span className="text-xs text-white/60">Завершено</span></div>
                    <div className="card p-3 text-center"><strong className="block text-xl">{enrolled.length ? Math.round(enrolled.reduce((sum,c) => sum + (c.progress || 0),0) / enrolled.length) : 0}%</strong><span className="text-xs text-white/60">Прогресс</span></div>
                </div>
            )}
            {continueCourse && (
                <section className="card p-4 sm:p-6 mb-6 border border-violet-soft/25" aria-label="Продолжить обучение">
                    <p className="text-xs font-bold tracking-wide uppercase text-violet-soft mb-2">Ваше обучение</p>
                    <h2 className="text-xl font-bold mb-3">{continueCourse.title}</h2>
                    <div className="flex justify-between text-xs text-white/70 mb-2"><span>Прогресс курса</span><strong className="text-white">{continueCourse.progress ?? 0}%</strong></div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-4">
                        <div className="h-full bg-violet-soft" style={{ width: (continueCourse.progress ?? 0) + '%' }} />
                    </div>
                    <Link to={resumeUrl(continueCourse)} className="btn-primary inline-flex min-h-11 items-center justify-center">
                        {continueCourse.progress === 100 ? 'Повторить курс →' : 'Продолжить обучение →'}
                    </Link>
                </section>
            )}
            {view === "mine" && enrolled.length === 0 && <div className="card p-5 mb-5 text-white/70">Вы пока не записаны на курсы. Выберите интересное направление во вкладке «Все курсы».</div>}
            <h2 className="font-bold text-xl mb-3">{view === "mine" ? "Мои курсы" : "Направления обучения"}</h2>
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 sm:flex-wrap" role="group" aria-label="Направление обучения">
                {[['all', 'Все'], ...Object.entries(CATEGORY_LABEL)].map(([k, l]) => (
                    <button key={k} onClick={() => setFilter(k)}
                            aria-pressed={filter === k} className={`chip shrink-0 min-h-10 px-3 ${filter === k ? 'bg-violet text-white' : 'bg-white/5 text-white/60'}`}>{l}</button>
                ))}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                {(view === "mine" ? shown.filter((c) => c.enrolled) : shown).map((c) => {
                    const lessonsCount = c.lessons?.length || 0;
                    const practicalsCount = c.lessons?.filter((l) => l.practical).length || 0;
                    const homeworksCount = c.lessons?.filter((l) => l.homework).length || 0;
                    const totalMinutes = c.lessons?.reduce((s, l) => s + (l.duration || 0), 0) || 0;
                    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

                    return (
                        <Link
                            key={c.id}
                            to={c.enrolled ? resumeUrl(c) : `/app/courses/${c.slug}`}
                            className="card overflow-hidden hover:-translate-y-1 transition flex flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-soft"
                        >
                            <div className="relative h-40 grid place-items-center text-5xl overflow-hidden"
                                 style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)' }}>
                                {c.cover ? (
                                    <>
                                        <img src={c.cover} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                        <span className="relative z-10 drop-shadow-lg">
                                            {CATEGORY_LABEL[c.category]?.split(' ')[0] || '📚'}
                                        </span>
                                    </>
                                ) : (
                                    <span>{CATEGORY_LABEL[c.category]?.split(' ')[0] || '📚'}</span>
                                )}
                            </div>

                            <div className="p-5 flex-1 flex flex-col">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs text-white/40 uppercase">
                                        {c.level === 'beginner' ? 'Для начинающих'
                                            : c.level === 'intermediate' ? 'Средний'
                                                : c.level === 'advanced' ? 'Продвинутый'
                                                    : c.level}
                                    </span>
                                </div>

                                <div className="font-bold text-lg mb-2">{c.title}</div>
                                {c.enrolled && <div className="text-xs text-violet-soft font-semibold mb-2">✓ Вы уже учитесь</div>}

                                <div className="text-sm text-white/60 line-clamp-4 leading-relaxed mb-4 flex-1">
                                    {c.description}
                                </div>

                                <div className="flex items-center gap-3 text-xs text-white/50 mb-3 flex-wrap">
                                    <span>📖 {lessonsCount} уроков</span>
                                    {practicalsCount > 0 && <span>🎯 {practicalsCount}</span>}
                                    {homeworksCount > 0 && <span>📋 {homeworksCount}</span>}
                                    {totalHours > 0 && <span>⏱ ~{totalHours} ч</span>}
                                </div>

                                <div className="flex items-center justify-between text-xs pt-3 border-t border-white/5">
                                    <span className="text-white/40">
                                        {c._count?.enrollments || 0} студентов
                                    </span>
                                    {c.enrolled ? (
                                        <span className="chip bg-lime/20 text-lime-soft">{c.progress ?? 0}%</span>
                                    ) : (
                                        <span className="chip bg-violet/20 text-violet-soft">Записаться</span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
            {shown.length === 0 && (
                <div className="card p-8 text-center text-white/70" role="status">
                    В этом направлении пока нет курсов. Попробуйте другое направление.
                </div>
            )}
        </div>
    );
}