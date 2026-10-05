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

    useEffect(() => { api('/courses', { token }).then(setCourses); }, [token]);

    const shown = filter === 'all' ? courses : courses.filter((c) => c.category === filter);

    usePageMeta({
        title: 'Обучение',
        description: 'Курсы медиацентра: видео, фото, звук, радио. Прокачай скиллы и получи сертификат.',
    });

    return (
        <div className="p-5 md:p-10 max-w-6xl mx-auto">
            <h1 className="text-3xl md:text-5xl font-bold mb-2">Обучение</h1>
            <p className="text-white/50 mb-6">Запишись на курсы и прокачай скиллы</p>

            <div className="flex gap-2 mb-6 flex-wrap">
                {[['all', 'Все'], ...Object.entries(CATEGORY_LABEL)].map(([k, l]) => (
                    <button key={k} onClick={() => setFilter(k)}
                            className={`chip ${filter === k ? 'bg-violet text-white' : 'bg-white/5 text-white/60'}`}>{l}</button>
                ))}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {shown.map((c) => {
                    const lessonsCount = c.lessons?.length || 0;
                    const practicalsCount = c.lessons?.filter((l) => l.practical).length || 0;
                    const homeworksCount = c.lessons?.filter((l) => l.homework).length || 0;
                    const totalMinutes = c.lessons?.reduce((s, l) => s + (l.duration || 0), 0) || 0;
                    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

                    return (
                        <Link
                            key={c.id}
                            to={`/app/courses/${c.slug}`}
                            className="card overflow-hidden hover:-translate-y-1 transition flex flex-col"
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
        </div>
    );
}