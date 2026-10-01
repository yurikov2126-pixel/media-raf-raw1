import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

// Пак реакций — эмодзи, сгруппированные по смыслу
export const REACTION_PACK = [
    { emoji: '❤️', label: 'Люблю' },
    { emoji: '🔥', label: 'Огонь' },
    { emoji: '👏', label: 'Браво' },
    { emoji: '😂', label: 'Смешно' },
    { emoji: '🤯', label: 'Вау' },
    { emoji: '😍', label: 'Красота' },
    { emoji: '🎬', label: 'Кино' },
    { emoji: '📸', label: 'Фото' },
    { emoji: '🎙️', label: 'Звук' },
    { emoji: '⭐', label: 'Топ' },
    { emoji: '💜', label: 'Медиа' },
    { emoji: '🫡', label: 'Респект' },
];

export default function PostReactions({ postId, initial }) {
    const { token, user } = useAuth();
    const [reactions, setReactions] = useState(initial?.reactions || []);
    const [mine, setMine] = useState(new Set(initial?.my || []));
    const [pickerOpen, setPickerOpen] = useState(false);
    const wrapRef = useRef(null);

    useEffect(() => {
        if (!token) return;
        api(`/posts/${postId}/reactions`, { token })
            .then((r) => {
                setReactions(r.reactions || []);
                setMine(new Set(r.my || []));
            })
            .catch(() => {});
    }, [postId, token]);

    useEffect(() => {
        const onDoc = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setPickerOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    const toggle = async (emoji) => {
        setPickerOpen(false);
        // Оптимистично
        const had = mine.has(emoji);
        const nextMine = new Set(mine);
        if (had) nextMine.delete(emoji); else nextMine.add(emoji);
        setMine(nextMine);
        setReactions((prev) => {
            const copy = prev.map((r) => ({ ...r, users: [...r.users] }));
            const existing = copy.find((r) => r.emoji === emoji);
            if (had) {
                if (existing) {
                    existing.count--;
                    existing.users = existing.users.filter((u) => u !== user.id);
                }
            } else {
                if (existing) {
                    existing.count++;
                    existing.users.push(user.id);
                } else {
                    copy.push({ emoji, count: 1, users: [user.id] });
                }
            }
            return copy.filter((r) => r.count > 0);
        });

        try {
            const res = await api(`/posts/${postId}/reactions`, {
                method: 'POST',
                token,
                body: { emoji },
            });
            setReactions(res.reactions || []);
            setMine(new Set(res.my || []));
        } catch (e) {
            // Откат
            setMine(mine);
            api(`/posts/${postId}/reactions`, { token }).then((r) => {
                setReactions(r.reactions || []);
                setMine(new Set(r.my || []));
            });
        }
    };

    const total = reactions.reduce((s, r) => s + r.count, 0);

    return (
        <div className="flex items-center gap-2 flex-wrap mt-3">
            {/* Список реакций с подсчётами */}
            {reactions.map((r) => (
                <button
                    key={r.emoji}
                    onClick={() => toggle(r.emoji)}
                    className={`chip text-sm px-2.5 py-1 transition ${
                        mine.has(r.emoji)
                            ? 'bg-violet/30 text-white'
                            : 'bg-white/5 hover:bg-white/10 text-white/80'
                    }`}
                    title={(r.users || []).length > 0 ? `${r.count}` : ''}
                >
                    <span className="text-base">{r.emoji}</span>
                    <span className="ml-1 font-semibold">{r.count}</span>
                </button>
            ))}

            {/* Кнопка добавления реакции */}
            <div className="relative" ref={wrapRef}>
                <button
                    onClick={() => setPickerOpen((o) => !o)}
                    className="chip bg-white/5 hover:bg-white/10 text-white/60"
                    title="Добавить реакцию"
                >
                    <span className="text-base">😊</span>
                    {total === 0 && <span className="ml-1">Реакция</span>}
                </button>

                {pickerOpen && (
                    <div className="absolute left-0 top-full mt-2 z-30 card p-2 w-64 animate-pop">
                        <div className="grid grid-cols-6 gap-1">
                            {REACTION_PACK.map((r) => (
                                <button
                                    key={r.emoji}
                                    onClick={() => toggle(r.emoji)}
                                    className={`text-2xl p-1.5 rounded-xl hover:bg-white/10 ${
                                        mine.has(r.emoji) ? 'bg-violet/30' : ''
                                    }`}
                                    title={r.label}
                                >
                                    {r.emoji}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}