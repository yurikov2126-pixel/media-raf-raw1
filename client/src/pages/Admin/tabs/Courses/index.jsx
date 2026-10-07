import { useState } from 'react';
import { api } from '../../../../api/client.js';
import { useToast } from '../../../../store/toast.jsx';
import { downloadJSON } from '../../utils.js';
import CourseEditor from './CourseEditor.jsx';

export default function Courses({ courses, setCourses, token }) {
    const toast = useToast();
    const [editingCourse, setEditingCourse] = useState(null);
    const [exporting, setExporting] = useState(null);

    const remove = async (id) => {
        if (!confirm('Удалить курс со всеми уроками?')) return;
        try {
            await api(`/admin/courses/${id}`, { method: 'DELETE', token });
            setCourses((prev) => prev.filter((x) => x.id !== id));
            toast.success('Курс удалён');
        } catch (e) {
            toast.error(e.message);
        }
    };

    const togglePublish = async (c) => {
        try {
            const u = await api(`/admin/courses/${c.id}`, {
                method: 'PATCH', token, body: { published: !c.published },
            });
            setCourses((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...u } : x)));
        } catch (e) {
            toast.error(e.message);
        }
    };

    const exportCourse = async (c) => {
        setExporting(c.id);
        try {
            const r = await api(`/admin/bulk/export-course/${c.id}`, { token });
            downloadJSON([r.course], `course-${c.slug}.json`);
            toast.success('Курс экспортирован');
        } catch (e) {
            toast.error(e.message);
        } finally {
            setExporting(null);
        }
    };

    const exportAll = async () => {
        setExporting('all');
        try {
            const r = await api('/admin/bulk/export-all-courses', { token });
            downloadJSON(r.courses, `mrr-courses-${new Date().toISOString().slice(0, 10)}.json`);
            toast.success(`Экспортировано курсов: ${r.courses.length}`);
        } catch (e) {
            toast.error(e.message);
        } finally {
            setExporting(null);
        }
    };

    const reloadAll = async () => {
        const list = await api('/admin/courses', { token });
        setCourses(list);
    };

    return (
        <div>
            <div className="flex gap-2 mb-4 flex-wrap">
                <button onClick={() => setEditingCourse({ mode: 'create' })} className="btn-primary">
                    ＋ Создать курс
                </button>
                <button onClick={exportAll} disabled={exporting === 'all' || courses.length === 0} className="btn-ghost">
                    {exporting === 'all' ? '⏳…' : '⬇ Экспорт всех курсов'}
                </button>
            </div>

            <div className="card divide-y divide-white/5">
                {courses.map((c) => (
                    <div key={c.id} className="p-4 flex items-center gap-3 flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                            <div className="font-bold">{c.title}</div>
                            <div className="text-xs text-white/40">
                                /{c.slug} · {c.category} · {c.lessons?.length || 0} уроков ·{' '}
                                {c._count?.enrollments || 0} студентов · {c._count?.certificates || 0} сертиф.
                                {c.dripMode && (
                                    <span className="ml-2 text-violet-soft">
                                        · drip: {c.dripMode === 'test' ? 'по тестам' : `кажд. ${c.dripInterval || 7} дн.`}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => togglePublish(c)}
                            className={`chip ${c.published ? 'bg-lime text-black' : 'bg-white/10'}`}
                        >
                            {c.published ? 'опубликован' : 'черновик'}
                        </button>
                        <button onClick={() => exportCourse(c)} disabled={exporting === c.id} className="chip bg-white/5 hover:bg-white/10" title="Экспорт JSON">
                            {exporting === c.id ? '⏳' : '⬇ JSON'}
                        </button>
                        <button onClick={() => setEditingCourse({ mode: 'edit', data: c })} className="chip bg-violet/30 hover:bg-violet/50">✏️</button>
                        <button onClick={() => remove(c.id)} className="chip bg-white/5 hover:bg-pink/30">🗑️</button>
                    </div>
                ))}
                {courses.length === 0 && <div className="p-6 text-center text-white/40">Курсов пока нет</div>}
            </div>

            {editingCourse && (
                <CourseEditor
                    course={editingCourse.data}
                    token={token}
                    onClose={() => setEditingCourse(null)}
                    onSaved={() => { setEditingCourse(null); reloadAll(); }}
                />
            )}
        </div>
    );
}