import { useEffect, useState } from 'react';
import { api } from '../../../api/client.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useModules } from '../../../store/modules.jsx';

export default function Modules({ token }) {
    const { reload: reloadActiveModules } = useModules();
    const [modules, setModules] = useState([]);
    const [draft, setDraft] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    // Онбординг
    const [onboarding, setOnboarding] = useState(null);
    const [confirmResetAll, setConfirmResetAll] = useState(false);
    const [resetBusy, setResetBusy] = useState(false);

    const loadModules = async () => {
        setLoading(true);
        try {
            const r = await api('/admin/modules', { token });
            setModules(r.modules);
            setDraft(Object.fromEntries(r.modules.map((m) => [m.key, m.enabled])));
        } catch (e) {
            setMessage('Ошибка: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const loadOnboarding = async () => {
        try {
            const r = await api('/admin/onboarding/info', { token });
            setOnboarding(r);
        } catch {}
    };

    useEffect(() => {
        loadModules();
        loadOnboarding();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const dirty = modules.some((m) => draft[m.key] !== m.enabled);

    const toggle = (key) => {
        setDraft((d) => ({ ...d, [key]: !d[key] }));
        setMessage('');
    };

    const resetDraft = () => {
        setDraft(Object.fromEntries(modules.map((m) => [m.key, m.enabled])));
        setMessage('');
    };

    const saveModules = async () => {
        if (!dirty) return;

        // Клиентская проверка: хотя бы один включён
        if (!Object.values(draft).some(Boolean)) {
            setMessage('Хотя бы один модуль должен быть включён');
            return;
        }

        setSaving(true);
        setMessage('');
        try {
            await api('/admin/modules', { method: 'PUT', token, body: { modules: draft } });
            await Promise.all([loadModules(), reloadActiveModules()]);
            setMessage('✓ Настройки сохранены');
            setTimeout(() => setMessage(''), 2500);
        } catch (e) {
            setMessage('Ошибка: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const resetOnboardingAll = async () => {
        setResetBusy(true);
        try {
            const r = await api('/admin/onboarding/reset-all', { method: 'POST', token });
            await loadOnboarding();
            setConfirmResetAll(false);
            setMessage(`✓ Онбординг сброшен для ${r.affected} пользователей`);
            setTimeout(() => setMessage(''), 3000);
        } catch (e) {
            setMessage('Ошибка: ' + e.message);
        } finally {
            setResetBusy(false);
        }
    };

    if (loading) {
        return <div className="card p-6 text-center text-white/50">Загрузка…</div>;
    }

    return (
        <div className="space-y-5">
            {/* ─── Модули ─── */}
            <div className="card p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                    <div>
                        <div className="font-bold text-lg">🧩 Модули платформы</div>
                        <div className="text-sm text-white/50 mt-1">
                            Отключённые модули скрываются из навигации, прямые ссылки
                            перенаправляют на доступный раздел, а API раздела блокируется.
                            Данные сохраняются и станут доступны после включения.
                        </div>
                    </div>
                    {dirty && (
                        <span className="chip bg-orange-500/20 text-orange-300 text-[10px] shrink-0">
                            ● Есть несохранённые изменения
                        </span>
                    )}
                </div>

                <div className="grid sm:grid-cols-2 gap-3 mb-4">
                    {modules.map((m) => (
                        <label
                            key={m.key}
                            className={`card p-4 cursor-pointer transition ${
                                draft[m.key]
                                    ? 'bg-violet/10 border-violet/40'
                                    : 'bg-white/5 border-white/5'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    checked={!!draft[m.key]}
                                    onChange={() => toggle(m.key)}
                                    disabled={saving}
                                    className="mt-0.5"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{m.icon}</span>
                                        <span className="font-semibold">{m.label}</span>
                                        <span
                                            className={`ml-auto chip text-[10px] ${
                                                draft[m.key]
                                                    ? 'bg-lime/20 text-lime'
                                                    : 'bg-white/10 text-white/50'
                                            }`}
                                        >
                                            {draft[m.key] ? 'включён' : 'выключен'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-white/50 mt-1">
                                        {m.description}
                                    </div>
                                </div>
                            </div>
                        </label>
                    ))}
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={saveModules}
                        disabled={saving || !dirty}
                        className="btn-primary !py-2 text-sm"
                    >
                        {saving ? '⏳' : '💾 Сохранить настройки'}
                    </button>
                    {dirty && (
                        <button
                            onClick={resetDraft}
                            disabled={saving}
                            className="btn-ghost !py-2 text-sm"
                        >
                            Отмена
                        </button>
                    )}
                </div>

                {message && (
                    <div className="mt-3 text-sm bg-white/5 rounded-xl p-3">{message}</div>
                )}
            </div>

            {/* ─── Онбординг ─── */}
            {onboarding && (
                <div className="card p-5">
                    <div className="font-bold text-lg mb-1">🎓 Обучение пользователей</div>
                    <div className="text-sm text-white/50 mb-4">
                        Короткий тур по платформе, который показывается новым
                        пользователям и при добавлении новых функций.
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="rounded-2xl bg-ink-700/50 p-3">
                            <div className="text-xs text-white/40 uppercase tracking-wider">
                                Версия
                            </div>
                            <div className="text-xl font-bold mt-1">
                                v{onboarding.currentVersion}
                            </div>
                        </div>
                        <div className="rounded-2xl bg-ink-700/50 p-3">
                            <div className="text-xs text-white/40 uppercase tracking-wider">
                                Не прошли
                            </div>
                            <div className="text-xl font-bold mt-1 text-orange-300">
                                {onboarding.stats.needsOnboarding}
                            </div>
                        </div>
                        <div className="rounded-2xl bg-ink-700/50 p-3">
                            <div className="text-xs text-white/40 uppercase tracking-wider">
                                Прошли
                            </div>
                            <div className="text-xl font-bold mt-1 text-lime">
                                {onboarding.stats.completed}
                            </div>
                        </div>
                    </div>

                    <details className="mb-4">
                        <summary className="text-xs text-white/40 cursor-pointer hover:text-white/60 select-none">
                            Шаги онбординга ({onboarding.steps.length})
                        </summary>
                        <div className="mt-2 space-y-1">
                            {onboarding.steps.map((s, i) => (
                                <div
                                    key={s.id}
                                    className="flex items-start gap-3 bg-white/5 rounded-xl px-3 py-2"
                                >
                                    <span className="text-lg shrink-0">{s.icon}</span>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-semibold">
                                            {i + 1}. {s.title}
                                            {s.moduleKey && (
                                                <span className="ml-2 text-[10px] text-white/40 uppercase">
                                                    модуль: {s.moduleKey}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-white/50 truncate">
                                            {s.text}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </details>

                    <div className="text-xs text-white/40 mb-3">
                        <b>Сброс онбординга</b>: пользователи увидят тур заново
                        при следующем входе. Работает, даже если они уже прошли его.
                    </div>

                    <button
                        onClick={() => setConfirmResetAll(true)}
                        disabled={resetBusy}
                        className="btn-ghost !py-2 text-sm text-pink"
                    >
                        {resetBusy ? '⏳' : '🔄 Показать обучение всем заново'}
                    </button>
                </div>
            )}

            <ConfirmDialog
                open={confirmResetAll}
                title="Показать обучение всем?"
                description={
                    onboarding
                        ? `Все ${onboarding.stats.total} пользователей увидят тур заново при следующем входе на платформу. Сейчас его видят ${onboarding.stats.needsOnboarding} (из них ${onboarding.stats.completed} уже проходили).`
                        : ''
                }
                confirmLabel="Показать всем"
                busy={resetBusy}
                onConfirm={resetOnboardingAll}
                onCancel={() => setConfirmResetAll(false)}
            />
        </div>
    );
}