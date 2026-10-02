import { useEffect, useState } from 'react';
import { api } from '../../../../api/client.js';
import { downloadJSON } from '../../utils.js';
import RecalcUserCourseForm from './RecalcUserCourseForm.jsx';
import BulkCourseAction from './BulkCourseAction.jsx';
import CurriculumImportForm from './CurriculumImportForm.jsx';

export default function Bulk({ token, users, courses, onReload }) {
    const [lastResult, setLastResult] = useState(null);
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState('');
    const [actions, setActions] = useState([]);

    const loadActions = () => {
        api('/admin/bulk/actions?limit=50', { token }).then(setActions).catch(() => {});
    };

    useEffect(() => { loadActions(); /* eslint-disable-next-line */ }, []);

    const run = async (endpoint, body, label) => {
        if (label && !confirm(`${label}\n\nПродолжить?`)) return;
        setBusy(endpoint); setError(''); setLastResult(null);
        try {
            const r = await api(endpoint, { method: 'POST', token, body });
            setLastResult({ endpoint, ...r });
            loadActions();
        } catch (e) { setError(e.message); }
        finally { setBusy(null); }
    };

    return (
        <div className="space-y-5">
            <div className="card p-5">
                <div className="font-bold text-lg mb-1">🛠 Пакетные действия</div>
                <div className="text-sm text-white/50 mb-4">Операции выполняются явно, логируются и не создают дублей.</div>

                {error && <div className="mb-4 text-sm text-pink bg-pink/10 rounded-xl p-3">{error}</div>}
                {lastResult && (
                    <div className="mb-4 text-sm bg-lime/10 border border-lime/30 rounded-xl p-4">
                        <div className="font-bold text-lime mb-1">✓ Выполнено</div>
                        <pre className="text-xs text-white/70 whitespace-pre-wrap">{JSON.stringify(lastResult, null, 2)}</pre>
                    </div>
                )}

                <div className="mb-5">
                    <div className="text-xs text-white/40 uppercase tracking-wider mb-2">A. Восстановление</div>
                    <div className="grid sm:grid-cols-2 gap-3">
                        <button onClick={() => run('/admin/bulk/recalc-all', {}, 'Пересчитать прогресс ВСЕХ enrollments?')} disabled={busy === '/admin/bulk/recalc-all'} className="btn-ghost justify-start">
                            {busy === '/admin/bulk/recalc-all' ? '⏳…' : '🔄 Пересчитать прогресс всех'}
                        </button>
                        <button onClick={() => run('/admin/bulk/issue-certificates', {}, 'Выдать сертификаты всем, у кого progress=100?')} disabled={busy === '/admin/bulk/issue-certificates'} className="btn-ghost justify-start">
                            {busy === '/admin/bulk/issue-certificates' ? '⏳…' : '🏆 Выдать пропущенные'}
                        </button>
                    </div>
                    <RecalcUserCourseForm token={token} users={users} courses={courses} />
                </div>

                <div className="mb-5">
                    <div className="text-xs text-white/40 uppercase tracking-wider mb-2">B. Массовые действия с курсом</div>
                    <BulkCourseAction token={token} courses={courses} onResult={(r, ep) => { setLastResult({ endpoint: ep, ...r }); loadActions(); }} />
                </div>

                <div className="mb-5">
                    <div className="text-xs text-white/40 uppercase tracking-wider mb-2">C. Импорт курсов</div>
                    <CurriculumImportForm token={token} onResult={(r) => { setLastResult({ endpoint: '/admin/bulk/import-curriculum', ...r }); loadActions(); onReload?.(); }} />
                </div>

                <div>
                    <div className="text-xs text-white/40 uppercase tracking-wider mb-2">D. Экспорт данных</div>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={async () => {
                            setBusy('/export-courses'); setError('');
                            try {
                                const r = await api('/admin/bulk/export-all-courses', { token });
                                downloadJSON(r.courses, `mrr-courses-${new Date().toISOString().slice(0, 10)}.json`);
                                setLastResult({ endpoint: '/admin/bulk/export-all-courses', affected: r.affected });
                                loadActions();
                            } catch (e) { setError(e.message); }
                            finally { setBusy(null); }
                        }} disabled={busy === '/export-courses'} className="btn-ghost">
                            {busy === '/export-courses' ? '⏳…' : '⬇ Все курсы (JSON)'}
                        </button>
                        <button onClick={async () => {
                            setBusy('/export-snapshot'); setError('');
                            try {
                                const r = await api('/admin/bulk/export', { method: 'POST', token });
                                downloadJSON(r.snapshot, `mrr-snapshot-${new Date().toISOString().slice(0, 10)}.json`);
                                setLastResult({ endpoint: '/admin/bulk/export', affected: r.affected });
                                loadActions();
                            } catch (e) { setError(e.message); }
                            finally { setBusy(null); }
                        }} disabled={busy === '/export-snapshot'} className="btn-ghost">
                            {busy === '/export-snapshot' ? '⏳…' : '⬇ Полный снапшот (JSON)'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                    <div className="font-bold">📜 Журнал операций</div>
                    <button onClick={loadActions} className="btn-ghost !py-1.5 !px-3 text-xs">Обновить</button>
                </div>
                <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
                    {actions.length === 0 && <div className="p-4 text-center text-white/40 text-sm">Пока пусто</div>}
                    {actions.map((a) => (
                        <div key={a.id} className="p-3 text-sm">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="chip bg-violet/20 text-violet-soft text-[10px]">{a.action}</span>
                                <span className="text-white/60">{a.admin.fullName}</span>
                                <span className="text-[10px] text-white/30">{new Date(a.createdAt).toLocaleString('ru-RU')}</span>
                                {a.affected > 0 && <span className="chip bg-lime/20 text-lime text-[10px] ml-auto">+{a.affected}</span>}
                                {a.error && <span className="chip bg-pink/20 text-pink text-[10px] ml-auto">ошибка</span>}
                            </div>
                            {a.error && <div className="text-xs text-pink/70 mt-1">{a.error}</div>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}