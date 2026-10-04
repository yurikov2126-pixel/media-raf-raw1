import { useEffect, useState } from 'react';
import { api } from '../../../api/client.js';
import Avatar from '../../../components/Avatar.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

const XP_LABELS = {
    post_created: 'Публикация поста',
    comment_created: 'Комментарий',
    lesson_completed: 'Пройденный урок',
    test_passed: 'Сданный тест',
    certificate_earned: 'Полученный сертификат',
    daily_login: 'Ежедневный вход',
    quest_completed_bonus: 'Бонус за квест',
};

const DEDUCT_LABELS = {
    post_deleted: 'Удаление поста',
    comment_deleted: 'Удаление комментария',
    test_failed: 'Провал теста',
    report_upheld: 'Подтверждённая жалоба',
};

const QUEST_TYPES = {
    post_count:         { label: 'Посты',        icon: '📝' },
    comment_count:      { label: 'Комментарии',  icon: '💬' },
    lesson_count:       { label: 'Уроки',        icon: '🎓' },
    test_pass:          { label: 'Тесты',        icon: '🧠' },
    reaction_given:     { label: 'Реакции',      icon: '❤️' },
    certificate_earned: { label: 'Сертификаты',  icon: '🏆' },
};

const RARITY_LABELS = {
    common: 'Обычное',
    rare: 'Редкое',
    epic: 'Эпическое',
    legendary: 'Легендарное',
};

const SUBTABS = [
    ['general', '⚙️ Основное'],
    ['rewards', '💎 Награды'],
    ['achievements', '🏅 Достижения'],
    ['levels', '📊 Уровни'],
    ['quests', '📜 Квесты'],
];

export default function Gamification({ token }) {
    const [subtab, setSubtab] = useState('general');
    const [settings, setSettings] = useState(null);
    const [draft, setDraft] = useState(null);
    const [overview, setOverview] = useState(null);
    const [catalog, setCatalog] = useState(null);
    const [achievements, setAchievements] = useState([]);
    const [levels, setLevels] = useState([]);
    const [levelDraft, setLevelDraft] = useState([]);
    const [templates, setTemplates] = useState([]);

    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [confirmReset, setConfirmReset] = useState(null);
    const [confirmRegen, setConfirmRegen] = useState(false);
    const [confirmResetAch, setConfirmResetAch] = useState(false);
    const [confirmResetLevels, setConfirmResetLevels] = useState(false);
    const [targetUser, setTargetUser] = useState(null);
    const [grantTarget, setGrantTarget] = useState(null);
    const [grantAmount, setGrantAmount] = useState(50);
    const [grantMode, setGrantMode] = useState('award');
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [editingAchievement, setEditingAchievement] = useState(null);

    /* ─── Загрузка ─── */
    const loadSettings = async () => {
        try {
            const s = await api('/admin/gamification/settings', { token });
            setSettings(s);
            setDraft({ ...s, xp: { ...s.xp }, deductions: { ...s.deductions } });
        } catch (e) { setMessage('Ошибка: ' + e.message); }
    };
    const loadOverview = async () => {
        try { setOverview(await api('/admin/gamification/overview', { token })); } catch {}
    };
    const loadCatalog = async () => {
        try { setCatalog(await api('/admin/gamification/catalog', { token })); } catch {}
    };
    const loadAchievements = async () => {
        try {
            const r = await api('/admin/gamification/achievements', { token });
            setAchievements(r.achievements || []);
        } catch {}
    };
    const loadLevels = async () => {
        try {
            const r = await api('/admin/gamification/levels', { token });
            setLevels(r.thresholds);
            setLevelDraft(r.thresholds);
        } catch {}
    };
    const loadTemplates = async () => {
        try {
            const r = await api('/admin/gamification/quest-templates', { token });
            setTemplates(r.templates || []);
        } catch {}
    };

    useEffect(() => {
        loadSettings();
        loadOverview();
        loadCatalog();
        loadAchievements();
        loadLevels();
        loadTemplates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    if (!settings || !draft) {
        return <div className="card p-6 text-center text-white/50">Загрузка…</div>;
    }

    const dirty = JSON.stringify(settings) !== JSON.stringify(draft);
    const levelsDirty = JSON.stringify(levels) !== JSON.stringify(levelDraft);

    /* ─── Сохранения ─── */
    const saveSettings = async () => {
        setBusy(true); setMessage('');
        try {
            await api('/admin/gamification/settings', {
                method: 'PUT', token,
                body: {
                    enabled: draft.enabled,
                    leaderboardEnabled: draft.leaderboardEnabled,
                    questsEnabled: draft.questsEnabled,
                    deductionsEnabled: draft.deductionsEnabled,
                    streakBonusEnabled: draft.streakBonusEnabled,
                    questsPerDay: draft.questsPerDay,
                    inactivityEnabled: draft.inactivityEnabled,
                    inactivityDays: draft.inactivityDays,
                    inactivityAmount: draft.inactivityAmount,
                    inactivityMaxDays: draft.inactivityMaxDays,
                    xp: draft.xp,
                    deductions: draft.deductions,
                },
            });
            await loadSettings();
            setMessage('✓ Сохранено');
            setTimeout(() => setMessage(''), 2000);
        } catch (e) { setMessage('Ошибка: ' + e.message); }
        finally { setBusy(false); }
    };

    const saveLevels = async () => {
        setBusy(true); setMessage('');
        try {
            const r = await api('/admin/gamification/levels', {
                method: 'PUT', token,
                body: { thresholds: levelDraft },
            });
            setLevels(r.thresholds);
            setLevelDraft(r.thresholds);
            setMessage('✓ Уровни сохранены');
            setTimeout(() => setMessage(''), 2000);
        } catch (e) { setMessage('Ошибка: ' + e.message); }
        finally { setBusy(false); }
    };

    const resetLevels = async () => {
        setConfirmResetLevels(false);
        setBusy(true);
        try {
            const r = await api('/admin/gamification/levels/reset-defaults', {
                method: 'POST', token,
            });
            setLevels(r.thresholds);
            setLevelDraft(r.thresholds);
            setMessage('✓ Уровни сброшены');
            setTimeout(() => setMessage(''), 2000);
        } catch (e) { setMessage('Ошибка: ' + e.message); }
        finally { setBusy(false); }
    };

    const doReset = async () => {
        setBusy(true);
        try {
            if (confirmReset === 'all') {
                await api('/admin/gamification/reset-all', { method: 'POST', token });
                setMessage('✓ Сброшено для всех');
            } else if (confirmReset === 'user' && targetUser) {
                await api(`/admin/gamification/reset-user/${targetUser.id}`, { method: 'POST', token });
                setMessage(`✓ Сброшено для ${targetUser.fullName}`);
            }
            setConfirmReset(null);
            setTargetUser(null);
            await loadOverview();
            setTimeout(() => setMessage(''), 2500);
        } catch (e) { setMessage('Ошибка: ' + e.message); }
        finally { setBusy(false); }
    };

    const doGrant = async () => {
        if (!grantTarget || !grantAmount) return;
        setBusy(true);
        try {
            const signed = grantMode === 'deduct' ? -Math.abs(grantAmount) : Math.abs(grantAmount);
            await api('/admin/gamification/grant-xp', {
                method: 'POST', token,
                body: { userId: grantTarget.id, amount: signed },
            });
            setMessage(`✓ ${grantMode === 'deduct' ? 'Списано' : 'Начислено'} ${Math.abs(grantAmount)} XP — ${grantTarget.fullName}`);
            setGrantTarget(null);
            await loadOverview();
            setTimeout(() => setMessage(''), 2500);
        } catch (e) { setMessage('Ошибка: ' + e.message); }
        finally { setBusy(false); }
    };

    const doRegenerate = async () => {
        setConfirmRegen(false);
        setBusy(true);
        try {
            const r = await api('/admin/gamification/quests/regenerate-all', { method: 'POST', token });
            setMessage(`✓ Удалено ${r.deleted} квестов. Пользователи получат новые при следующем заходе.`);
            await loadOverview();
            setTimeout(() => setMessage(''), 3000);
        } catch (e) { setMessage('Ошибка: ' + e.message); }
        finally { setBusy(false); }
    };

    const updateDraft = (patch) => setDraft((d) => ({ ...d, ...patch }));
    const updateXp = (key, value) =>
        setDraft((d) => ({ ...d, xp: { ...d.xp, [key]: Number(value) || 0 } }));
    const updateDeduct = (key, value) =>
        setDraft((d) => ({ ...d, deductions: { ...d.deductions, [key]: Math.abs(Number(value) || 0) } }));

    /* ─── Достижения CRUD ─── */
    const saveAchievement = async () => {
        if (!editingAchievement?.data) return;
        const data = editingAchievement.data;
        setBusy(true);
        try {
            if (editingAchievement.mode === 'create') {
                await api('/admin/gamification/achievements', { method: 'POST', token, body: data });
            } else {
                await api(`/admin/gamification/achievements/${data.id}`, { method: 'PATCH', token, body: data });
            }
            setEditingAchievement(null);
            await loadAchievements();
        } catch (e) { alert(e.message); }
        finally { setBusy(false); }
    };

    const deleteAchievement = async (id) => {
        if (!confirm('Удалить достижение?')) return;
        try {
            await api(`/admin/gamification/achievements/${id}`, { method: 'DELETE', token });
            await loadAchievements();
        } catch (e) { alert(e.message); }
    };

    const doResetAch = async () => {
        setConfirmResetAch(false);
        setBusy(true);
        try {
            await api('/admin/gamification/achievements/reset-defaults', { method: 'POST', token });
            await loadAchievements();
            setMessage('✓ Достижения сброшены к дефолтным');
            setTimeout(() => setMessage(''), 2500);
        } catch (e) { setMessage('Ошибка: ' + e.message); }
        finally { setBusy(false); }
    };

    /* ─── Шаблоны квестов CRUD ─── */
    const saveTemplate = async () => {
        if (!editingTemplate?.data) return;
        const data = editingTemplate.data;
        setBusy(true);
        try {
            if (editingTemplate.mode === 'create') {
                await api('/admin/gamification/quest-templates', { method: 'POST', token, body: data });
            } else {
                await api(`/admin/gamification/quest-templates/${data.id}`, { method: 'PATCH', token, body: data });
            }
            setEditingTemplate(null);
            await loadTemplates();
        } catch (e) { alert(e.message); }
        finally { setBusy(false); }
    };

    const deleteTemplate = async (id) => {
        if (!confirm('Удалить шаблон?')) return;
        try {
            await api(`/admin/gamification/quest-templates/${id}`, { method: 'DELETE', token });
            await loadTemplates();
        } catch (e) { alert(e.message); }
    };

    const resetTemplates = async () => {
        if (!confirm('Сбросить шаблоны квестов к стандартным?')) return;
        try {
            await api('/admin/gamification/quest-templates/reset-defaults', { method: 'POST', token });
            await loadTemplates();
        } catch (e) { alert(e.message); }
    };

    return (
        <div className="space-y-5">
            {/* ─── Подтабы ─── */}
            <div className="card p-4 flex flex-wrap gap-2">
                {SUBTABS.map(([k, l]) => (
                    <button
                        key={k}
                        onClick={() => setSubtab(k)}
                        className={`chip ${subtab === k ? 'bg-violet text-white' : 'bg-white/5 text-white/60'}`}
                    >
                        {l}
                    </button>
                ))}
            </div>

            {message && <div className="card p-3 text-sm bg-white/5">{message}</div>}

            {/* ═══════════ ОСНОВНОЕ ═══════════ */}
            {subtab === 'general' && (
                <>
                    <div className="card p-5">
                        <div className="font-bold text-lg mb-1">🎮 Геймификация</div>
                        <div className="text-sm text-white/50 mb-4">
                            Включение системы и базовые флаги.
                        </div>
                        <div className="space-y-2">
                            {[
                                ['enabled', 'Система включена', 'Начисление XP, уровни, достижения'],
                                ['questsEnabled', 'Ежедневные квесты', 'Новые задания каждый день'],
                                ['deductionsEnabled', 'Штрафы за нарушения', 'Вычет XP за удаления, провалы тестов и жалобы'],
                                ['streakBonusEnabled', 'Бонус за серию дней', '+2 XP за каждый день подряд'],
                                ['leaderboardEnabled', 'Показывать рейтинг', 'Раздел «Рейтинг» и пункт меню'],
                            ].map(([key, title, desc]) => (
                                <label key={key} className="flex items-center justify-between gap-3 cursor-pointer p-3 rounded-xl bg-white/5 hover:bg-white/10">
                                    <div>
                                        <div className="font-semibold">{title}</div>
                                        <div className="text-xs text-white/50">{desc}</div>
                                    </div>
                                    <input type="checkbox" checked={!!draft[key]} onChange={(e) => updateDraft({ [key]: e.target.checked })} disabled={busy} />
                                </label>
                            ))}
                        </div>
                        {draft.questsEnabled && (
                            <div className="mt-3">
                                <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Квестов в день</label>
                                <input type="number" min="1" max="10" className="input" value={draft.questsPerDay} onChange={(e) => updateDraft({ questsPerDay: Number(e.target.value) || 3 })} disabled={busy} />
                            </div>
                        )}
                    </div>

                    <div className="card p-5">
                        <div className="font-bold mb-1">💤 Штраф за отсутствие</div>
                        <div className="text-sm text-white/50 mb-4">
                            Раз в сутки списывается XP за каждый день отсутствия.
                        </div>
                        <label className="flex items-center gap-2 mb-4 cursor-pointer">
                            <input type="checkbox" checked={!!draft.inactivityEnabled} onChange={(e) => updateDraft({ inactivityEnabled: e.target.checked })} disabled={busy || !draft.enabled || !draft.deductionsEnabled} />
                            <span>Включить штраф</span>
                        </label>
                        <div className="grid sm:grid-cols-3 gap-3">
                            {[
                                ['inactivityDays', 'Порог (дней)', 1, 60, 3],
                                ['inactivityAmount', 'XP за день', 0, 1000, 5],
                                ['inactivityMaxDays', 'Макс. дней', 1, 60, 7],
                            ].map(([key, label, min, max, def]) => (
                                <div key={key}>
                                    <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">{label}</label>
                                    <input type="number" min={min} max={max} className="input" value={draft[key] ?? def} onChange={(e) => updateDraft({ [key]: Number(e.target.value) || def })} disabled={busy || !draft.inactivityEnabled} />
                                </div>
                            ))}
                        </div>
                    </div>

                    <SaveRow dirty={dirty} busy={busy} onSave={saveSettings} onCancel={() => setDraft({ ...settings, xp: { ...settings.xp }, deductions: { ...settings.deductions } })} />
                </>
            )}

            {/* ═══════════ НАГРАДЫ ═══════════ */}
            {subtab === 'rewards' && (
                <>
                    <div className="card p-5">
                        <div className="font-bold mb-4">💎 Награды за действия</div>
                        <div className="grid sm:grid-cols-2 gap-3">
                            {Object.keys(XP_LABELS).map((key) => (
                                <div key={key}>
                                    <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">{XP_LABELS[key]}</label>
                                    <input type="number" min="0" max="10000" className="input" value={draft.xp[key] ?? 0} onChange={(e) => updateXp(key, e.target.value)} disabled={busy || !draft.enabled} />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="card p-5">
                        <div className="font-bold mb-4">⚠️ Штрафы</div>
                        <div className="grid sm:grid-cols-2 gap-3">
                            {Object.keys(DEDUCT_LABELS).map((key) => (
                                <div key={key}>
                                    <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">-{DEDUCT_LABELS[key]}</label>
                                    <input type="number" min="0" max="10000" className="input" value={draft.deductions[key] ?? 0} onChange={(e) => updateDeduct(key, e.target.value)} disabled={busy || !draft.enabled || !draft.deductionsEnabled} />
                                </div>
                            ))}
                        </div>
                    </div>

                    <SaveRow dirty={dirty} busy={busy} onSave={saveSettings} onCancel={() => setDraft({ ...settings, xp: { ...settings.xp }, deductions: { ...settings.deductions } })} />
                </>
            )}

            {/* ═══════════ ДОСТИЖЕНИЯ ═══════════ */}
            {subtab === 'achievements' && (
                <>
                    <div className="card p-5">
                        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                            <div>
                                <div className="font-bold text-lg">🏅 Достижения</div>
                                <div className="text-sm text-white/50 mt-1">
                                    Counter-based достижения. Night-owl и Early-bird задаются в коде и здесь не отображаются.
                                </div>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={() => setEditingAchievement({
                                        mode: 'create',
                                        data: { id: '', title: '', description: '', icon: '🏆', rarity: 'common', counter: 'postsCount', threshold: 1, active: true, order: 500 },
                                    })}
                                    className="btn-ghost !py-2 text-sm"
                                >
                                    ＋ Добавить
                                </button>
                                <button
                                    onClick={() => setConfirmResetAch(true)}
                                    className="btn-ghost !py-2 text-sm"
                                >
                                    🔄 Сбросить к дефолтным
                                </button>
                            </div>
                        </div>

                        {achievements.length === 0 && (
                            <div className="text-center text-white/40 py-6 text-sm">Достижений нет. Нажмите «Сбросить к дефолтным».</div>
                        )}

                        <div className="divide-y divide-white/5">
                            {achievements.map((a) => (
                                <div key={a.id} className={`py-3 flex items-center gap-3 flex-wrap ${!a.active ? 'opacity-50' : ''}`}>
                                    <div className="w-10 h-10 grid place-items-center rounded-xl bg-white/5 text-lg shrink-0">
                                        {a.icon}
                                    </div>
                                    <div className="flex-1 min-w-[200px]">
                                        <div className="font-semibold text-sm">{a.title}</div>
                                        <div className="text-xs text-white/40">
                                            <span className="font-mono">{a.id}</span> · {RARITY_LABELS[a.rarity] || a.rarity}
                                            {a.counter && ` · ${a.counter} ≥ ${a.threshold}`}
                                            {!a.active && ' · выключено'}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setEditingAchievement({
                                            mode: 'edit',
                                            data: { ...a },
                                        })}
                                        className="chip bg-white/5 hover:bg-violet/30 text-xs"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => deleteAchievement(a.id)}
                                        className="chip bg-white/5 hover:bg-pink/30 text-xs"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* ═══════════ УРОВНИ ═══════════ */}
            {subtab === 'levels' && (
                <>
                    <div className="card p-5">
                        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                            <div>
                                <div className="font-bold text-lg">📊 Уровни</div>
                                <div className="text-sm text-white/50 mt-1">
                                    Порог XP для каждого уровня. Level 1 всегда 0, пороги должны возрастать.
                                </div>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={() => setConfirmResetLevels(true)}
                                    className="btn-ghost !py-2 text-sm"
                                >
                                    🔄 Сбросить к формуле
                                </button>
                                <button
                                    onClick={() => setLevelDraft([...levelDraft, (levelDraft[levelDraft.length - 1] || 0) + 500])}
                                    className="btn-ghost !py-2 text-sm"
                                >
                                    ＋ Добавить уровень
                                </button>
                                <button
                                    onClick={() => {
                                        if (levelDraft.length <= 2) return;
                                        setLevelDraft(levelDraft.slice(0, -1));
                                    }}
                                    disabled={levelDraft.length <= 2}
                                    className="btn-ghost !py-2 text-sm"
                                >
                                    − Удалить последний
                                </button>
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[500px] overflow-y-auto pr-1">
                            {levelDraft.map((xp, i) => {
                                const prev = i > 0 ? levelDraft[i - 1] : -1;
                                const isFirst = i === 0;
                                const invalid = !isFirst && xp <= prev;
                                return (
                                    <div key={i} className={`flex items-center gap-2 p-2 rounded-xl ${invalid ? 'bg-pink/10 border border-pink/30' : 'bg-white/5'}`}>
                                        <div className="w-10 text-center text-sm font-bold shrink-0">
                                            {i + 1}
                                        </div>
                                        <input
                                            type="number"
                                            min={isFirst ? 0 : prev + 1}
                                            className="input !py-1.5 text-sm flex-1 min-w-0"
                                            value={xp}
                                            onChange={(e) => {
                                                const v = Number(e.target.value) || 0;
                                                setLevelDraft((arr) => arr.map((x, j) => j === i ? v : x));
                                            }}
                                            disabled={isFirst || busy}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        <div className="text-xs text-white/40 mt-3">
                            Всего {levelDraft.length} уровней. Максимальный уровень: {levelDraft.length} (достигается при {levelDraft[levelDraft.length - 1]} XP).
                        </div>

                        <div className="flex gap-2 items-center flex-wrap mt-4">
                            <button
                                onClick={saveLevels}
                                disabled={busy || !levelsDirty}
                                className="btn-primary"
                            >
                                {busy ? '…' : '💾 Сохранить уровни'}
                            </button>
                            {levelsDirty && (
                                <button onClick={() => setLevelDraft(levels)} disabled={busy} className="btn-ghost">
                                    Отмена
                                </button>
                            )}
                            {levelsDirty && (
                                <span className="chip bg-orange-500/20 text-orange-300 text-[10px]">
                                    ● Есть несохранённые изменения
                                </span>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* ═══════════ КВЕСТЫ ═══════════ */}
            {subtab === 'quests' && (
                <>
                    <div className="card p-5">
                        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                            <div>
                                <div className="font-bold text-lg">📜 Шаблоны квестов</div>
                                <div className="text-sm text-white/50 mt-1">
                                    Из этих шаблонов генерируются индивидуальные ежедневные квесты.
                                    Вес влияет на частоту выпадения.
                                </div>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                <button onClick={() => setEditingTemplate({ mode: 'create', data: { type: 'post_count', target: 1, xpReward: 30, label: '', icon: '📝', weight: 1, active: true } })} className="btn-ghost !py-2 text-sm">＋ Добавить</button>
                                <button onClick={resetTemplates} className="btn-ghost !py-2 text-sm">🔄 Сбросить</button>
                                <button onClick={() => setConfirmRegen(true)} className="btn-primary !bg-orange-500 !py-2 text-sm">🔁 Перегенерировать всем</button>
                            </div>
                        </div>

                        <div className="text-xs text-white/40 p-3 rounded-xl bg-white/5 mb-4">
                            💡 Если у студента есть активный курс (progress &lt; 100%), среди его квестов
                            гарантированно будет хотя бы один обучающий (урок/тест/сертификат).
                        </div>

                        {templates.length === 0 && (
                            <div className="text-center text-white/40 py-6 text-sm">Шаблонов нет. Нажмите «Сбросить».</div>
                        )}

                        <div className="divide-y divide-white/5">
                            {templates.map((t) => {
                                const meta = QUEST_TYPES[t.type] || {};
                                return (
                                    <div key={t.id} className={`py-3 flex items-center gap-3 flex-wrap ${!t.active ? 'opacity-50' : ''}`}>
                                        <div className="w-10 h-10 grid place-items-center rounded-xl bg-white/5 text-lg shrink-0">
                                            {t.icon || meta.icon || '⭐'}
                                        </div>
                                        <div className="flex-1 min-w-[200px]">
                                            <div className="font-semibold text-sm">{t.label || meta.label || t.type}</div>
                                            <div className="text-xs text-white/40">
                                                {meta.label || t.type} · цель: {t.target} · +{t.xpReward} XP · вес: {t.weight}
                                                {!t.active && ' · выключен'}
                                            </div>
                                        </div>
                                        <button onClick={() => setEditingTemplate({ mode: 'edit', data: { id: t.id, type: t.type, target: t.target, xpReward: t.xpReward, label: t.label || '', icon: t.icon || '', weight: t.weight, active: t.active } })} className="chip bg-white/5 hover:bg-violet/30 text-xs">✏️</button>
                                        <button onClick={() => deleteTemplate(t.id)} className="chip bg-white/5 hover:bg-pink/30 text-xs">🗑️</button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* ─── Статистика + топ-10 ─── */}
            {overview && subtab === 'general' && (
                <>
                    <div className="card p-5">
                        <div className="font-bold mb-4">📊 Общая статистика</div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <StatBox value={overview.totalUsers} label="Участников" />
                            <StatBox value={overview.activeUsers} label="Активных за 7 дней" color="text-lime" />
                            <StatBox value={overview.totalXp.toLocaleString('ru-RU')} label="Всего XP" />
                            <StatBox value={overview.avgLevel} label="Средний уровень" />
                            <StatBox value={overview.questsCompletedToday} label="Квестов сегодня" color="text-violet-soft" />
                        </div>
                    </div>

                    {overview.topUsers?.length > 0 && (
                        <div className="card p-5">
                            <div className="font-bold mb-3">🏆 Топ-10 по опыту</div>
                            <div className="divide-y divide-white/5">
                                {overview.topUsers.map((s, i) => (
                                    <div key={s.userId} className="py-2.5 flex items-center gap-3">
                                        <div className="w-8 text-center text-lg shrink-0">
                                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-sm text-white/40">{i + 1}</span>}
                                        </div>
                                        <Avatar user={s.user} size={32} />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold truncate">{s.user.fullName}</div>
                                            <div className="text-xs text-white/40">
                                                @{s.user.username} · ур. {s.level}
                                                {s.streakCurrent > 0 && ` · 🔥 ${s.streakCurrent}`}
                                            </div>
                                        </div>
                                        <div className="text-sm font-bold tabular-nums">{s.xp.toLocaleString('ru-RU')} XP</div>
                                        <div className="flex gap-1">
                                            <button onClick={() => { setGrantTarget(s.user); setGrantMode('award'); }} className="chip bg-white/5 hover:bg-violet/30 text-[10px]">+</button>
                                            <button onClick={() => { setGrantTarget(s.user); setGrantMode('deduct'); }} className="chip bg-white/5 hover:bg-orange-500/30 text-[10px]">−</button>
                                            <button onClick={() => { setTargetUser(s.user); setConfirmReset('user'); }} className="chip bg-white/5 hover:bg-pink/30 text-[10px]">↺</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="card p-5 border border-pink/20">
                        <div className="font-bold text-pink mb-2">⚠️ Опасная зона</div>
                        <div className="text-sm text-white/60 mb-3">
                            Полный сброс: обнулит XP, уровни, серии, достижения и квесты у всех.
                        </div>
                        <button onClick={() => setConfirmReset('all')} disabled={busy} className="btn-ghost text-pink">
                            Сбросить прогресс всех
                        </button>
                    </div>
                </>
            )}

            {/* ─── Модалки ─── */}
            {editingTemplate && (
                <TemplateEditor
                    data={editingTemplate.data}
                    isNew={editingTemplate.mode === 'create'}
                    busy={busy}
                    onChange={(patch) => setEditingTemplate((e) => ({ ...e, data: { ...e.data, ...patch } }))}
                    onSave={saveTemplate}
                    onClose={() => !busy && setEditingTemplate(null)}
                />
            )}

            {editingAchievement && (
                <AchievementEditor
                    data={editingAchievement.data}
                    isNew={editingAchievement.mode === 'create'}
                    counterOptions={catalog?.counterOptions || []}
                    busy={busy}
                    onChange={(patch) => setEditingAchievement((e) => ({ ...e, data: { ...e.data, ...patch } }))}
                    onSave={saveAchievement}
                    onClose={() => !busy && setEditingAchievement(null)}
                />
            )}

            {grantTarget && (
                <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm grid place-items-center p-4" onClick={() => !busy && setGrantTarget(null)}>
                    <div className="card max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
                        <div className="text-2xl mb-2">{grantMode === 'award' ? '✨' : '⚠️'}</div>
                        <h3 className="text-xl font-bold mb-3">{grantMode === 'award' ? 'Начислить XP' : 'Вычесть XP'}</h3>
                        <div className="text-sm text-white/60 mb-4">Пользователь: <b>{grantTarget.fullName}</b></div>
                        <input type="number" min="1" max="10000" className="input mb-3" value={grantAmount} onChange={(e) => setGrantAmount(e.target.value)} />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setGrantTarget(null)} disabled={busy} className="btn-ghost">Отмена</button>
                            <button onClick={doGrant} disabled={busy || !grantAmount} className={grantMode === 'award' ? 'btn-primary' : 'btn-primary !bg-orange-500'}>
                                {busy ? '…' : grantMode === 'award' ? 'Начислить' : 'Списать'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog open={!!confirmReset} title={confirmReset === 'all' ? 'Сбросить у всех?' : 'Сбросить у пользователя?'} description={confirmReset === 'all' ? 'XP, уровни, серии, достижения и квесты будут обнулены у ВСЕХ.' : `Прогресс ${targetUser?.fullName} будет обнулён.`} confirmLabel="Сбросить" danger busy={busy} onConfirm={doReset} onCancel={() => !busy && (setConfirmReset(null), setTargetUser(null))} />
            <ConfirmDialog open={confirmRegen} title="Перегенерировать квесты всем?" description="Удалятся все квесты на сегодня у ВСЕХ. Новые создадутся автоматически при следующем заходе." confirmLabel="Перегенерировать" danger busy={busy} onConfirm={doRegenerate} onCancel={() => setConfirmRegen(false)} />
            <ConfirmDialog open={confirmResetAch} title="Сбросить достижения?" description="Все кастомные достижения будут удалены, восстановятся дефолтные. Прогресс пользователей по ним (UserAchievement) сохранится." confirmLabel="Сбросить" danger busy={busy} onConfirm={doResetAch} onCancel={() => setConfirmResetAch(false)} />
            <ConfirmDialog open={confirmResetLevels} title="Сбросить уровни к формуле?" description="Текущие пороги уровней будут заменены на сгенерированные по формуле." confirmLabel="Сбросить" danger busy={busy} onConfirm={resetLevels} onCancel={() => setConfirmResetLevels(false)} />
        </div>
    );
}

/* ─── Мелкие компоненты ─── */

function SaveRow({ dirty, busy, onSave, onCancel }) {
    return (
        <div className="flex gap-2 items-center flex-wrap">
            <button onClick={onSave} disabled={busy || !dirty} className="btn-primary">
                {busy ? '…' : '💾 Сохранить настройки'}
            </button>
            {dirty && (
                <button onClick={onCancel} disabled={busy} className="btn-ghost">Отмена</button>
            )}
            {dirty && (
                <span className="chip bg-orange-500/20 text-orange-300 text-[10px]">
                    ● Есть несохранённые изменения
                </span>
            )}
        </div>
    );
}

function StatBox({ value, label, color = '' }) {
    return (
        <div className="rounded-2xl bg-ink-700/50 p-4">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-white/50">{label}</div>
        </div>
    );
}

function TemplateEditor({ data, isNew, busy, onChange, onSave, onClose }) {
    const meta = QUEST_TYPES[data.type] || {};
    return (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
            <div className="card max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">{isNew ? 'Новый шаблон квеста' : 'Редактировать шаблон'}</h3>
                    <button onClick={onClose} disabled={busy} className="text-white/40 hover:text-white text-xl">✕</button>
                </div>
                <div className="rounded-2xl bg-white/5 p-4 mb-4 flex items-center gap-3">
                    <div className="w-12 h-12 grid place-items-center rounded-xl bg-white/5 text-2xl">
                        {data.icon || meta.icon || '⭐'}
                    </div>
                    <div>
                        <div className="font-semibold">{data.label || meta.label || data.type}</div>
                        <div className="text-xs text-white/50">Цель: {data.target} · +{data.xpReward} XP</div>
                    </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 mb-3">
                    <div className="sm:col-span-2">
                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Тип</label>
                        <select className="input" value={data.type} onChange={(e) => onChange({ type: e.target.value })} disabled={busy}>
                            {Object.entries(QUEST_TYPES).map(([k, v]) => (
                                <option key={k} value={k}>{v.icon} {v.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Цель</label>
                        <input type="number" min="1" max="100" className="input" value={data.target} onChange={(e) => onChange({ target: Number(e.target.value) || 1 })} disabled={busy} />
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Награда (XP)</label>
                        <input type="number" min="1" max="10000" className="input" value={data.xpReward} onChange={(e) => onChange({ xpReward: Number(e.target.value) || 1 })} disabled={busy} />
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Вес</label>
                        <input type="number" min="1" max="100" className="input" value={data.weight} onChange={(e) => onChange({ weight: Number(e.target.value) || 1 })} disabled={busy} />
                    </div>
                    <div>
                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Иконка</label>
                        <input className="input text-center text-xl" maxLength={4} value={data.icon || ''} onChange={(e) => onChange({ icon: e.target.value })} disabled={busy} />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Название (опционально)</label>
                        <input className="input" placeholder={meta.label} value={data.label || ''} onChange={(e) => onChange({ label: e.target.value })} disabled={busy} />
                    </div>
                    <div className="sm:col-span-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={data.active !== false} onChange={(e) => onChange({ active: e.target.checked })} disabled={busy} />
                            <span>Активен</span>
                        </label>
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} disabled={busy} className="btn-ghost">Отмена</button>
                    <button onClick={onSave} disabled={busy} className="btn-primary">{busy ? '…' : isNew ? 'Создать' : 'Сохранить'}</button>
                </div>
            </div>
        </div>
    );
}

function AchievementEditor({ data, isNew, counterOptions, busy, onChange, onSave, onClose }) {
    const RARITIES = [
        { v: 'common', l: 'Обычное' },
        { v: 'rare', l: 'Редкое' },
        { v: 'epic', l: 'Эпическое' },
        { v: 'legendary', l: 'Легендарное' },
    ];
    return (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
            <div className="card max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">{isNew ? 'Новое достижение' : 'Редактировать достижение'}</h3>
                    <button onClick={onClose} disabled={busy} className="text-white/40 hover:text-white text-xl">✕</button>
                </div>

                <div className="rounded-2xl bg-white/5 p-4 mb-4 flex items-center gap-3">
                    <div className="w-12 h-12 grid place-items-center rounded-xl bg-white/5 text-2xl">{data.icon || '🏆'}</div>
                    <div className="min-w-0">
                        <div className="font-semibold truncate">{data.title || 'Без названия'}</div>
                        <div className="text-xs text-white/50 truncate">{data.description || 'Описание'}</div>
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 mb-3">
                    <div className="sm:col-span-2">
                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">ID (a-z, 0-9, _)</label>
                        <input
                            className="input font-mono text-sm"
                            value={data.id || ''}
                            onChange={(e) => onChange({ id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                            placeholder="my_achievement"
                            disabled={busy || !isNew}
                        />
                        {!isNew && <div className="text-[10px] text-white/40 mt-1">ID нельзя менять после создания</div>}
                    </div>

                    <div className="sm:col-span-2">
                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Название</label>
                        <input className="input" value={data.title || ''} onChange={(e) => onChange({ title: e.target.value })} disabled={busy} />
                    </div>

                    <div className="sm:col-span-2">
                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Описание</label>
                        <input className="input" value={data.description || ''} onChange={(e) => onChange({ description: e.target.value })} disabled={busy} />
                    </div>

                    <div>
                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Иконка</label>
                        <input className="input text-center text-xl" maxLength={4} value={data.icon || ''} onChange={(e) => onChange({ icon: e.target.value })} disabled={busy} />
                    </div>

                    <div>
                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Редкость</label>
                        <select className="input" value={data.rarity} onChange={(e) => onChange({ rarity: e.target.value })} disabled={busy}>
                            {RARITIES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Счётчик</label>
                        <select className="input" value={data.counter || ''} onChange={(e) => onChange({ counter: e.target.value || null })} disabled={busy}>
                            <option value="">— не задан —</option>
                            {counterOptions.map((c) => (
                                <option key={c.v} value={c.v}>{c.l}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Порог</label>
                        <input type="number" min="1" max="10000" className="input" value={data.threshold ?? ''} onChange={(e) => onChange({ threshold: e.target.value ? Number(e.target.value) : null })} disabled={busy || !data.counter} />
                    </div>

                    <div>
                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">Порядок</label>
                        <input type="number" className="input" value={data.order ?? 0} onChange={(e) => onChange({ order: Number(e.target.value) || 0 })} disabled={busy} />
                    </div>

                    <div className="sm:col-span-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={data.active !== false} onChange={(e) => onChange({ active: e.target.checked })} disabled={busy} />
                            <span>Активно</span>
                        </label>
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <button onClick={onClose} disabled={busy} className="btn-ghost">Отмена</button>
                    <button onClick={onSave} disabled={busy} className="btn-primary">{busy ? '…' : isNew ? 'Создать' : 'Сохранить'}</button>
                </div>
            </div>
        </div>
    );
}