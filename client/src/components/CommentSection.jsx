import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import Avatar from './Avatar.jsx';


function CommentText({ content }) {
    return <>{String(content || '').split(/(@\[[^\]\n]{1,120}\]\([\p{L}\p{N}_]{1,50}\)|@[\p{L}\p{N}_]{1,50})/u).map((part, i) => {
        const named = part.match(/^@\[([^\]\n]{1,120})\]\(([\p{L}\p{N}_]{1,50})\)$/u);
        if (named) return <Link key={i} to={`/app/u/${named[2]}`} className="text-violet-500 font-semibold hover:underline">@{named[1]}</Link>;
        if (/^@[\p{L}\p{N}_]{1,50}$/u.test(part)) return <Link key={i} to={`/app/u/${part.slice(1)}`} className="text-violet-500 font-semibold hover:underline">{part}</Link>;
        return part;
    })}</>;
}


function MentionInput({ value, onChange, onSubmit, placeholder }) {
    const { token } = useAuth();
    const inputRef = useRef(null);
    const [match, setMatch] = useState(null);
    const [options, setOptions] = useState([]);
    const [selected, setSelected] = useState(0);
    const update = (next, caret) => {
        onChange(next);
        const found = next.slice(0, caret).match(/(^|[^\p{L}\p{N}_])@([\p{L}\p{N}_]{1,50})$/u);
        setMatch(found ? { start: caret - found[2].length - 1, end: caret, query: found[2] } : null);
        setSelected(0);
    };
    useEffect(() => {
        if (!match || !token) { setOptions([]); return; }
        let active = true;
        const timer = setTimeout(() => {
            api('/feed2/mentions?q=' + encodeURIComponent(match.query), { token })
                .then((users) => { if (active) setOptions(users); })
                .catch(() => { if (active) setOptions([]); });
        }, 220);
        return () => { active = false; clearTimeout(timer); };
    }, [match?.query, token]);
    const choose = (person) => {
        if (!match) return;
        const label = String(person.fullName || person.username).replace(/[\[\]()]/g, '');
        const mention = '@[' + label + '](' + person.username + ')';
        const next = value.slice(0, match.start) + mention + ' ' + value.slice(match.end);
        const caret = match.start + mention.length + 1;
        onChange(next);
        setMatch(null);
        setOptions([]);
        requestAnimationFrame(() => {
            inputRef.current?.focus();
            inputRef.current?.setSelectionRange(caret, caret);
        });
    };
    return (
        <div className="relative flex-1 min-w-0">
            <input
                ref={inputRef}
                className="input !py-2 text-sm w-full"
                placeholder={placeholder}
                value={value}
                onChange={(e) => update(e.target.value, e.target.selectionStart)}
                onClick={(e) => update(e.target.value, e.target.selectionStart)}
                onKeyDown={(e) => {
                    if (options.length && match && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                        e.preventDefault();
                        setSelected((index) => (index + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (options.length && match) choose(options[selected] || options[0]);
                        else onSubmit();
                    } else if (e.key === 'Escape') {
                        setMatch(null);
                        setOptions([]);
                    }
                }}
            />
            {match && options.length > 0 && (
                <div className="absolute z-50 bottom-full mb-2 left-0 right-0 max-h-56 overflow-y-auto rounded-xl border border-violet-400/30 bg-[var(--bg-elev-2)] shadow-xl p-1" aria-label="Подсказки упоминаний">
                    {options.map((person, index) => (
                        <button
                            type="button"
                            key={person.id}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => choose(person)}
                            className={'w-full text-left rounded-lg px-3 py-2 text-sm ' + (index === selected ? 'bg-violet-500/15' : 'hover:bg-violet-500/10')}
                        >
                            <span className="font-semibold">{person.fullName || person.username}</span>
                            <span className="opacity-60 ml-2">@{person.username}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function CommentItem({ comment, depth = 0, onChanged, onDeleted, highlightCommentId = '', highlightedPath = [] }) {
    const { user, token } = useAuth();
    const [replying, setReplying] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [busy, setBusy] = useState(false);
    const [showReplies, setShowReplies] = useState(depth === 0 || highlightedPath.includes(comment.id));
    const targetRef = useRef(null);
    useEffect(() => {
        if (highlightCommentId !== comment.id || !targetRef.current) return;
        // The target may be mounted after parent replies expand. Scroll only after it exists.
        let secondFrame;
        const firstFrame = requestAnimationFrame(() => {
            secondFrame = requestAnimationFrame(() => {
                targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        });
        return () => { cancelAnimationFrame(firstFrame); if (secondFrame) cancelAnimationFrame(secondFrame); };
    }, [highlightCommentId, comment.id]);
    useEffect(() => { if (highlightedPath.includes(comment.id)) setShowReplies(true); }, [highlightedPath, comment.id]);

    const isMine = comment.author.id === user.id || user.role === 'ADMIN';
    const maxDepth = 4;
    const nextDepth = Math.min(depth + 1, maxDepth);

    const sendReply = async () => {
        if (!replyText.trim()) return;
        setBusy(true);
        try {
            const c = await api(`/posts/${comment.postId}/comments`, {
                method: 'POST',
                token,
                body: { content: replyText, parentId: comment.id },
            });
            onChanged?.(c, comment.id);
            setReplyText('');
            setReplying(false);
            setShowReplies(true);
        } catch (e) {
            alert(e.message);
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!confirm('Удалить комментарий?')) return;
        try {
            await api(`/posts/comments/${comment.id}`, { method: 'DELETE', token });
            onDeleted?.(comment.id);
        } catch (e) {
            alert(e.message);
        }
    };

    const shareComment = async () => {
        const url = new URL('/app/feed', window.location.origin);
        url.searchParams.set('post', comment.postId);
        url.searchParams.set('comment', comment.id);
        try {
            if (navigator.share) {
                await navigator.share({ title: 'Комментарий MEDIA·RAF·RAW', url: url.toString() });
            } else if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(url.toString());
                setLinkCopied(true);
            } else {
                window.prompt('Скопируйте ссылку на комментарий:', url.toString());
            }
        } catch (error) {
            if (error?.name === 'AbortError') return;
            try {
                await navigator.clipboard.writeText(url.toString());
                setLinkCopied(true);
            } catch {
                window.prompt('Скопируйте ссылку на комментарий:', url.toString());
            }
        }
    };

    const repliesCount = comment.replies?.length || 0;

    return (
        <div ref={targetRef} data-comment-id={comment.id} className={`${depth > 0 ? 'ml-8 md:ml-10 border-l border-white/10 pl-3' : ''} ${highlightCommentId === comment.id ? 'rounded-xl ring-2 ring-violet-400 bg-violet-500/10' : ''}`}>
            <div className="flex gap-2 py-2">
                <Link to={`/app/u/${comment.author.username}`} className="shrink-0">
                    <Avatar user={comment.author} size={32} />
                </Link>
                <div className="flex-1 min-w-0">
                    <div className="bg-ink-700/60 rounded-2xl px-3 py-2">
                        <div className="flex items-center gap-2 mb-0.5">
                            <Link
                                to={`/app/u/${comment.author.username}`}
                                className="font-semibold text-sm hover:underline truncate"
                            >
                                {comment.author.fullName}
                            </Link>
                            <span className="text-[10px] text-white/30">
                {new Date(comment.createdAt).toLocaleString('ru-RU', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                })}
              </span>
                        </div>
                        <div className="text-sm whitespace-pre-wrap break-words"><CommentText content={comment.content} /></div>
                    </div>

                    <div className="flex items-center gap-3 mt-1 px-1 text-xs text-white/50">
                        <button
                            onClick={() => setReplying((v) => !v)}
                            className="hover:text-white"
                        >
                            Ответить
                        </button>
                        <button
                            type="button"
                            onClick={shareComment}
                            className="hover:text-violet-400"
                            aria-label="Поделиться ссылкой на комментарий"
                        >
                            {linkCopied ? '✓ Ссылка скопирована' : '🔗 Поделиться'}
                        </button>
                        {isMine && (
                            <button onClick={remove} className="hover:text-pink">
                                Удалить
                            </button>
                        )}
                        {repliesCount > 0 && (
                            <button
                                onClick={() => setShowReplies((v) => !v)}
                                className="hover:text-white"
                            >
                                {showReplies ? 'Скрыть' : `Показать ответы (${repliesCount})`}
                            </button>
                        )}
                    </div>

                    {replying && (
                        <div className="mt-2 flex gap-2">
                            <MentionInput value={replyText} onChange={setReplyText} onSubmit={sendReply} placeholder={'Ответ ' + comment.author.fullName + '…'} />
                            <button
                                onClick={sendReply}
                                disabled={busy || !replyText.trim()}
                                className="btn-primary !py-2 !px-3 text-sm shrink-0"
                            >
                                {busy ? '…' : '→'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {showReplies && repliesCount > 0 && (
                <div>
                    {comment.replies.map((r) => (
                        <CommentItem
                            key={r.id}
                            comment={r}
                            depth={nextDepth}
                            onChanged={onChanged}
                            onDeleted={onDeleted}
                            highlightCommentId={highlightCommentId}
                            highlightedPath={highlightedPath}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function CommentSection({ postId, initialCount = 0, highlightCommentId = '' }) {
    const { user, token } = useAuth();
    const [comments, setComments] = useState([]);
    const [text, setText] = useState('');
    const [open, setOpen] = useState(initialCount > 0 || Boolean(highlightCommentId));
    const [busy, setBusy] = useState(false);

    const load = () => {
        if (!token) return;
        api(`/posts/${postId}/comments`, { token }).then(setComments).catch(() => {});
    };

    useEffect(() => { load(); }, [postId, token]);

    const highlightedPath = [];
    const findPath = (list, ancestors = []) => {
        for (const item of list) {
            if (item.id === highlightCommentId) { highlightedPath.push(...ancestors); return true; }
            if (findPath(item.replies || [], [...ancestors, item.id])) return true;
        }
        return false;
    };
    if (highlightCommentId) findPath(comments);
    useEffect(() => { if (highlightCommentId) setOpen(true); }, [highlightCommentId]);

    const send = async () => {
        if (!text.trim()) return;
        setBusy(true);
        try {
            const c = await api(`/posts/${postId}/comments`, {
                method: 'POST', token, body: { content: text },
            });
            setComments((prev) => [...prev, { ...c, replies: [] }]);
            setText('');
            setOpen(true);
        } catch (e) {
            alert(e.message);
        } finally {
            setBusy(false);
        }
    };

    const totalCount = (list) =>
        list.reduce((s, c) => s + 1 + totalCount(c.replies || []), 0);

    const count = totalCount(comments);

    const handleAdded = (newComment, parentId) => {
        setComments((prev) => {
            const add = (list) =>
                list.map((c) => {
                    if (c.id === parentId) {
                        return { ...c, replies: [...(c.replies || []), { ...newComment, replies: [] }] };
                    }
                    return { ...c, replies: add(c.replies || []) };
                });
            return add(prev);
        });
    };

    const handleDeleted = (id) => {
        const remove = (list) =>
            list
                .filter((c) => c.id !== id)
                .map((c) => ({ ...c, replies: remove(c.replies || []) }));
        setComments((prev) => remove(prev));
    };

    return (
        <div className="mt-3 border-t border-white/5 pt-3">
            <button
                onClick={() => setOpen((v) => !v)}
                className="text-sm text-white/60 hover:text-white"
            >
                💬 Комментарии{count > 0 ? ` (${count})` : ''} {open ? '▲' : '▼'}
            </button>

            {open && (
                <div className="mt-3">
                    {/* Комментарии */}
                    {comments.length === 0 && (
                        <div className="text-xs text-white/40 text-center py-3">
                            Пока нет комментариев. Будьте первым!
                        </div>
                    )}
                    {comments.map((c) => (
                        <CommentItem
                            key={c.id}
                            comment={c}
                            onChanged={handleAdded}
                            onDeleted={handleDeleted}
                            highlightCommentId={highlightCommentId}
                            highlightedPath={highlightedPath}
                        />
                    ))}

                    {/* Форма нового комментария */}
                    <div className="flex gap-2 mt-3">
                        <Avatar user={user} size={32} />
                        <MentionInput value={text} onChange={setText} onSubmit={send} placeholder="Написать комментарий… @участник" />
                        <button
                            onClick={send}
                            disabled={busy || !text.trim()}
                            className="btn-primary !py-2 !px-4 text-sm shrink-0"
                        >
                            {busy ? '…' : '→'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}