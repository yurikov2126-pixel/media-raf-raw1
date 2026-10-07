import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../../api/client.js';
import { useToast } from '../../../store/toast.jsx';
import ChangePasswordModal from '../../../components/ChangePasswordModal.jsx';

const ROLES = ['STUDENT', 'MENTOR', 'ADMIN'];
const DIRECTIONS = ['photo', 'video', 'radio', 'sound'];
const DIR_LABEL = {
    photo: '📸 Фото',
    video: '🎥 Видео',
    radio: '📻 Радио',
    sound: '🎚️ Звук',
};

export default function Users({ users, setUsers, token }) {
    const toast = useToast();
    const [searchParams, setSearchParams] = useSearchParams();

    const q = searchParams.get('q') ?? '';
    const role = searchParams.get('role') ?? '';
    const direction = searchParams.get('direction') ?? '';
    const status = searchParams.get('status') ?? '';
    const sortDesc = searchParams.get('sort') !== 'asc';

    const updateFilters = (patch) => {
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                for (const [k, v] of Object.entries(patch)) {
                    if (v === '' || v === null || v === undefined) next.delete(k);
                    else next.set(k, String(v));
                }
                return next;
            },
            { replace: true }
        );
    };

    const [resetting, setResetting] = useState(null);
    const [selected, setSelected] = useState(new Set());
    const [bulkBusy, setBulkBusy] = useState(false);

    const filtered = useMemo(() => {
        let list = [...users];
        const s = q.trim().toLowerCase();
        if (s) {
            list = list.filter(
                (u) =>
                    u.fullName.toLowerCase().includes(s) ||
                    u.username.toLowerCase().includes(s) ||
                    (u.phone || '').includes(s) ||
                    (u.email || '').toLowerCase().includes(s) ||
                    (u.group || '').toLowerCase().includes(s)
            );
        }
        if (role) list = list.filter((u) => u.role === role);
        if (direction) list = list.filter((u) => u.direction === direction);
        if (status === 'banned') list = list.filter((u) => u.isBanned);
        if (status === 'active') list = list.filter((u) => !u.isBanned);
        list.sort((a, b) => {
            const da = new Date(a.createdAt).getTime();
            const db = new Date(b.createdAt).getTime();
            return sortDesc ? db - da : da - db;
        });
        return list;
    }, [users, q, role, direction, status, sortDesc]);

    const updateUser = async (id, patch) => {
        try {
            const u = await api(`/admin/users/${id}`, {
                method: 'PATCH',
                token,
                body: patch,
            });
            setUsers((prev) => prev.map((x) => (x.id === id ? u : x)));
        } catch (e) {
            toast.error(e.message);
        }
    };

    const deleteUser = async (id) => {
        if (!confirm('Удалить пользователя со всеми данными?')) return;
        try {
            await api(`/admin/users/${id}`, { method: 'DELETE', token });
            setUsers((prev) => prev.filter((x) => x.id !== id));
            toast.success('Пользователь удалён');
        } catch (e) {
            toast.error(e.message);
        }
    };

    const toggleSelect = (id) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selected.size === filtered.length) setSelected(new Set());
        else setSelected(new Set(filtered.map((u) => u.id)));
    };

    const bulkAction = async (action, payload) => {
        if (selected.size === 0) return;
        if (!confirm(`Применить «${action}» к ${selected.size} пользователям?`)) return;
        setBulkBusy(true);
        try {
            const ids = [...selected];
            let done = 0;
            let failed = 0;
            for (const id of ids) {
                try {
                    if (action === 'delete') {
                        await api(`/admin/users/${id}`, { method: 'DELETE', token });
                        setUsers((prev) => prev.filter((x) => x.id !== id));
                    } else {
                        const u = await api(`/admin/users/${id}`, {
                            method: 'PATCH',
                            token,
                            body: payload,
                        });
                        setUsers((prev) => prev.map((x) => (x.id === id ? u : x)));
                    }
                    done++;
                } catch {
                    failed++;
                }
            }
            setSelected(new Set());
            if (failed === 0) {
                toast.success(`Обработано: ${done} из ${ids.length}`);
            } else {
                toast.warn(`Обработано: ${done}, ошибок: ${failed} из ${ids.length}`);
            }
        } finally {
            setBulkBusy(false);
        }
    };

    const exportCSV = () => {
        const header = [
            'ID',
            'ФИО',
            'Username',
            'Телефон',
            'Email',
            'Группа',
            'Направление',
            'Роль',
            'Забанен',
            'Регистрация',
        ];
        const rows = filtered.map((u) => [
            u.id,
            u.fullName,
            u.username,
            u.phone,
            u.email || '',
            u.group || '',
            u.direction || '',
            u.role,
            u.isBanned ? 'да' : 'нет',
            new Date(u.createdAt).toLocaleDateString('ru-RU'),
        ]);
        const csv = [header, ...rows]
            .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 500);
        toast.success(`Экспортировано: ${filtered.length} строк`);
    };

    const anyFilter = q || role || direction || status || !sortDesc;

    const resetFilters = () => {
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                for (const k of ['q', 'role', 'direction', 'status', 'sort']) {
                    next.delete(k);
                }
                return next;
            },
            { replace: true }
        );
    };

    return (
        <>
            <div className="card p-4 mb-4">
                <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                    <input
                        className="input"
                        placeholder="Поиск: имя, @ник, телефон, email, группа…"
                        value={q}
                        onChange={(e) => updateFilters({ q: e.target.value })}
                    />
                    <select
                        className="input"
                        value={role}
                        onChange={(e) => updateFilters({ role: e.target.value })}
                    >
                        <option value="">Все роли</option>
                        {ROLES.map((r) => (
                            <option key={r} value={r}>
                                {r}
                            </option>
                        ))}
                    </select>
                    <select
                        className="input"
                        value={direction}
                        onChange={(e) => updateFilters({ direction: e.target.value })}
                    >
                        <option value="">Все направления</option>
                        {DIRECTIONS.map((d) => (
                            <option key={d} value={d}>
                                {DIR_LABEL[d]}
                            </option>
                        ))}
                    </select>
                    <select
                        className="input"
                        value={status}
                        onChange={(e) => updateFilters({ status: e.target.value })}
                    >
                        <option value="">Все статусы</option>
                        <option value="active">Активные</option>
                        <option value="banned">Забаненные</option>
                    </select>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-sm text-white/50">
                        Найдено: <b>{filtered.length}</b> из {users.length}
                    </div>
                    <button
                        onClick={() =>
                            updateFilters({ sort: sortDesc ? 'asc' : '' })
                        }
                        className="chip bg-white/5 hover:bg-white/10 text-xs"
                        title="Сортировка по дате регистрации"
                    >
                        📅 {sortDesc ? 'Новые сверху' : 'Старые сверху'}
                    </button>
                    <button
                        onClick={exportCSV}
                        disabled={filtered.length === 0}
                        className="chip bg-white/5 hover:bg-white/10 text-xs"
                    >
                        ⬇ CSV
                    </button>
                    <button
                        onClick={toggleSelectAll}
                        className="chip bg-white/5 hover:bg-white/10 text-xs"
                    >
                        {selected.size === filtered.length && filtered.length > 0
                            ? '☑ Снять выделение'
                            : '☐ Выбрать все'}
                    </button>
                    {anyFilter && (
                        <button onClick={resetFilters} className="btn-ghost !py-1 text-xs ml-auto">
                            Сбросить фильтры
                        </button>
                    )}
                </div>

                {selected.size > 0 && (
                    <div className="mt-3 p-3 rounded-xl bg-violet/10 border border-violet/30 flex items-center gap-2 flex-wrap">
                        <div className="text-sm">
                            Выбрано: <b>{selected.size}</b>
                        </div>
                        <div className="ml-auto flex gap-2 flex-wrap">
                            <button
                                onClick={() => bulkAction('role', { role: 'MENTOR' })}
                                disabled={bulkBusy}
                                className="chip bg-white/5 hover:bg-white/10 text-xs"
                            >
                                → MENTOR
                            </button>
                            <button
                                onClick={() => bulkAction('role', { role: 'STUDENT' })}
                                disabled={bulkBusy}
                                className="chip bg-white/5 hover:bg-white/10 text-xs"
                            >
                                → STUDENT
                            </button>
                            <button
                                onClick={() => bulkAction('ban', { isBanned: true })}
                                disabled={bulkBusy}
                                className="chip bg-pink/20 hover:bg-pink/40 text-xs"
                            >
                                🚫 Забанить
                            </button>
                            <button
                                onClick={() => bulkAction('unban', { isBanned: false })}
                                disabled={bulkBusy}
                                className="chip bg-lime/20 hover:bg-lime/40 text-xs"
                            >
                                ✓ Разбанить
                            </button>
                            <button
                                onClick={() => bulkAction('delete')}
                                disabled={bulkBusy}
                                className="chip bg-pink/30 hover:bg-pink/50 text-xs"
                            >
                                🗑️ Удалить
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="card divide-y divide-white/5">
                {filtered.map((u) => (
                    <div key={u.id} className="p-4 flex items-center gap-3 flex-wrap">
                        <input
                            type="checkbox"
                            checked={selected.has(u.id)}
                            onChange={() => toggleSelect(u.id)}
                        />
                        <div className="flex-1 min-w-[180px]">
                            <div className="font-bold">{u.fullName}</div>
                            <div className="text-xs text-white/40">
                                @{u.username} · {u.phone}
                                {u.email ? ` · ${u.email}` : ''}
                                {u.group ? ` · ${u.group}` : ''}
                            </div>
                        </div>
                        <select
                            value={u.role}
                            onChange={(e) => updateUser(u.id, { role: e.target.value })}
                            className="input !py-2 !w-auto"
                        >
                            {ROLES.map((r) => (
                                <option key={r} value={r}>
                                    {r}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => updateUser(u.id, { isBanned: !u.isBanned })}
                            className={`chip ${
                                u.isBanned
                                    ? 'bg-pink text-white'
                                    : 'bg-white/5 text-white/60'
                            }`}
                        >
                            {u.isBanned ? 'разбан' : 'бан'}
                        </button>
                        <button
                            onClick={() => setResetting(u)}
                            className="chip bg-white/5 hover:bg-violet/30"
                            title="Сбросить пароль"
                        >
                            🔑
                        </button>
                        <button
                            onClick={() => deleteUser(u.id)}
                            className="chip bg-white/5 hover:bg-pink/30"
                            title="Удалить"
                        >
                            🗑️
                        </button>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className="p-6 text-center text-white/40">
                        {users.length === 0
                            ? 'Пользователей пока нет'
                            : 'Ничего не найдено'}
                    </div>
                )}
            </div>

            {resetting && (
                <ChangePasswordModal
                    mode="reset"
                    userId={resetting.id}
                    userName={resetting.fullName}
                    onClose={() => setResetting(null)}
                />
            )}
        </>
    );
}