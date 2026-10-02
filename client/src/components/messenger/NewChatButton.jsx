import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../store/auth.jsx';
import Avatar from '../Avatar.jsx';

export default function NewChatButton({ onCreated }) {
    const { token, user } = useAuth();
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState('direct');
    const [users, setUsers] = useState([]);
    const [title, setTitle] = useState('');
    const [selected, setSelected] = useState([]);
    const [q, setQ] = useState('');

    useEffect(() => {
        if (!open || !token) return;
        api(`/users${q ? `?q=${encodeURIComponent(q)}` : ''}`, { token }).then(setUsers);
    }, [open, token, q]);

    const createDirect = async (userId) => {
        const chat = await api('/chats/direct', { method: 'POST', token, body: { userId } });
        setOpen(false);
        onCreated(chat.id);
    };

    const createGroup = async () => {
        const chat = await api('/chats/group', {
            method: 'POST',
            token,
            body: { title, memberIds: selected },
        });
        setOpen(false);
        onCreated(chat.id);
    };

    const modal = open
        ? createPortal(
            <div
                className="fixed inset-0 z-[100] bg-black/60 grid place-items-center p-4"
                onClick={() => setOpen(false)}
            >
                <div className="card p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="font-bold text-lg">Новый чат</div>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="w-9 h-9 grid place-items-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition text-xl"
                            aria-label="Закрыть"
                        >✕</button>
                    </div>

                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => setTab('direct')}
                            className={`chip ${tab === 'direct' ? 'bg-violet text-white' : 'bg-white/5'}`}
                        >Личный</button>
                        <button
                            onClick={() => setTab('group')}
                            className={`chip ${tab === 'group' ? 'bg-pink text-white' : 'bg-white/5'}`}
                        >Группа</button>
                    </div>

                    {tab === 'group' && (
                        <input
                            className="input mb-3"
                            placeholder="Название группы"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    )}
                    <input
                        className="input mb-3"
                        placeholder="Поиск людей…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                    <div className="max-h-72 overflow-y-auto">
                        {users.filter((u) => u.id !== user.id).map((u) => (
                            <button
                                key={u.id}
                                onClick={() =>
                                    tab === 'direct'
                                        ? createDirect(u.id)
                                        : setSelected((s) =>
                                            s.includes(u.id) ? s.filter((x) => x !== u.id) : [...s, u.id]
                                        )
                                }
                                className={`w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 ${
                                    selected.includes(u.id) ? 'bg-violet/20' : ''
                                }`}
                            >
                                <Avatar user={u} size={36} />
                                <div className="text-left flex-1">
                                    <div className="font-semibold">{u.fullName}</div>
                                    <div className="text-xs text-white/40">@{u.username}</div>
                                </div>
                                {tab === 'group' && selected.includes(u.id) && <span>✓</span>}
                            </button>
                        ))}
                    </div>
                    {tab === 'group' && (
                        <button
                            onClick={createGroup}
                            disabled={!title || selected.length === 0}
                            className="btn-primary w-full mt-4"
                        >Создать группу</button>
                    )}
                </div>
            </div>,
            document.body
        )
        : null;

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="btn-ghost !p-2 text-sm"
                title="Новый чат"
            >＋</button>
            {modal}
        </>
    );
}