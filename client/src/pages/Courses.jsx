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
                {[['all','Все'], ...Object.entries(CATEGORY_LABEL)].map(([k, l]) => (
                    <button key={k} onClick={() => setFilter(k)}
                            className={`chip ${filter === k ? 'bg-violet text-white' : 'bg-white/5 text-white/60'}`}>{l}</button>
                ))}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {shown.map((c) => (
                    <Link key={c.id} to={`/app/courses/${c.slug}`} className="card overflow-hidden hover:-translate-y-1 transition">
                        <div className="h-36 grid place-items-center text-5xl"
                             style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)' }}>
                            {CATEGORY_LABEL[c.category]?.split(' ')[0] || '📚'}
                        </div>
                        <div className="p-5">
                            <div className="text-xs text-white/40 mb-1">{c.level}</div>
                            <div className="font-bold text-lg mb-2">{c.title}</div>
                            <div className="text-sm text-white/60 line-clamp-2 mb-3">{c.description}</div>
                            <div className="flex items-center justify-between text-xs text-white/50">
                                <span>{c.lessons.length} уроков · {c._count.enrollments} студентов</span>
                                {c.enrolled ? (
                                    <span className="chip bg-lime/20 text-lime-soft">{c.progress ?? 0}%</span>
                                ) : (
                                    <span className="chip bg-violet/20 text-violet-soft">Записаться</span>
                                )}
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}