import { useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import { api, resolveUrl } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import PostReactions from './PostReactions.jsx';
import CommentSection from './CommentSection.jsx';
import ReportButton from './ReportButton.jsx';

export default function PostCard({ post, author, onChanged, onDeleted }) {
    const { user, token } = useAuth();
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(post.content || '');
    const [busy, setBusy] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    const isOwner = author?.id === user.id || post.authorId === user.id;
    const isAdmin = user.role === 'ADMIN';
    const canEdit = isOwner || isAdmin;

    const save = async () => {
        setBusy(true);
        try {
            const updated = await api(`/posts/${post.id}`, {
                method: 'PATCH',
                token,
                body: { content: text },
            });
            onChanged?.({ ...post, ...updated });
            setEditing(false);
        } catch (e) {
            alert(e.message);
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!confirm('Удалить пост?')) return;
        try {
            await api(`/posts/${post.id}`, { method: 'DELETE', token });
            onDeleted?.(post.id);
        } catch (e) {
            alert(e.message);
        }
    };

    const commentCount = post._count?.comments ?? 0;

    return (
        <article className="card-flat p-5 post-stack">
            {(canEdit || !isOwner) && (
                <div className="absolute top-4 right-4">
                    <button
                        onClick={() => setMenuOpen((v) => !v)}
                        className="w-8 h-8 grid place-items-center rounded-full hover:bg-white/10 text-white/40"
                    >
                        ⋯
                    </button>
                    {menuOpen && (
                        <>
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => setMenuOpen(false)}
                            />
                            <div className="absolute right-0 top-9 z-20 card p-1 w-48 animate-pop">
                                {canEdit && (
                                    <>
                                        <button
                                            onClick={() => {
                                                setMenuOpen(false);
                                                setEditing(true);
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5"
                                        >
                                            ✏️ Редактировать
                                        </button>
                                        <button
                                            onClick={() => {
                                                setMenuOpen(false);
                                                remove();
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5 text-pink"
                                        >
                                            🗑️ Удалить
                                        </button>
                                    </>
                                )}
                                {!isOwner && (
                                    <button
                                        onClick={() => {
                                            setMenuOpen(false);
                                            // Открываем модалку жалобы через внешний триггер
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5"
                                        as="div"
                                    >
                                        <span onClick={(e) => e.stopPropagation()}>
                                            {/* Кнопка жалобы через собственный state */}
                                        </span>
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            <Link
                to={`/app/u/${author?.username}`}
                className="flex items-center gap-3 mb-3 hover:opacity-80"
            >
                <Avatar user={author} size={44} />
                <div className="min-w-0">
                    <div className="font-semibold truncate">{author?.fullName || 'Автор'}</div>
                    <div className="text-xs text-white/40 truncate">
                        @{author?.username} · {new Date(post.createdAt).toLocaleString('ru-RU')}
                        {post.editedAt && <span className="ml-2 opacity-60">(изм.)</span>}
                    </div>
                </div>
            </Link>

            {editing ? (
                <div>
                    <textarea
                        className="input resize-none"
                        rows={3}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />
                    <div className="flex justify-end gap-2 mt-3">
                        <button
                            onClick={() => {
                                setEditing(false);
                                setText(post.content || '');
                            }}
                            className="btn-ghost !py-2"
                        >
                            Отмена
                        </button>
                        <button onClick={save} disabled={busy} className="btn-primary !py-2">
                            {busy ? '…' : 'Сохранить'}
                        </button>
                    </div>
                </div>
            ) : (
                post.content && <p className="whitespace-pre-wrap text-white/90">{post.content}</p>
            )}

            {post.mediaUrl && (
                <div className="mt-3 rounded-2xl overflow-hidden">
                    <img
                        src={resolveUrl(post.mediaUrl)}
                        alt=""
                        className="w-full object-cover"
                        loading="lazy"
                    />
                </div>
            )}

            <PostReactions
                postId={post.id}
                initial={{ reactions: post.reactions || [], my: [] }}
            />

            {!isOwner && (
                <div className="mt-2 flex justify-end">
                    <ReportButton
                        targetType="post"
                        targetId={post.id}
                        className="chip bg-white/5 hover:bg-pink/30 text-xs"
                    />
                </div>
            )}

            <CommentSection postId={post.id} initialCount={commentCount} />
        </article>
    );
}