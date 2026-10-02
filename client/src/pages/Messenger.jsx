import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { api, uploadFile, resolveUrl } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import { useSocket, useOnlineUsers } from '../store/socket.jsx';
import { useNotifications } from '../store/notifications.jsx';
import Avatar from '../components/Avatar.jsx';
import MessageText from '../components/MessageText.jsx';
import MentionSuggest from '../components/MentionSuggest.jsx';
import PinnedBar from '../components/PinnedBar.jsx';
import VoicePlayer from '../components/VoicePlayer.jsx';
import MediaGalleryModal from '../components/MediaGalleryModal.jsx';
import { STICKERS, Sticker, QUICK_EMOJI } from '../stickers/pack.jsx';

/* ─── Утилиты для записи голосовых ─── */

function pickAudioMime() {
    if (typeof MediaRecorder === 'undefined') return null;
    const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
    ];
    for (const c of candidates) {
        try { if (MediaRecorder.isTypeSupported(c)) return c; } catch {}
    }
    return '';
}

function extFromMime(mime) {
    if (!mime) return 'webm';
    if (mime.includes('mp4')) return 'm4a';
    if (mime.includes('ogg')) return 'ogg';
    if (mime.includes('webm')) return 'webm';
    return 'audio';
}

export default function Messenger() {
    const { chatId } = useParams();
    const { user, token } = useAuth();
    const socket = useSocket();
    const onlineUsers = useOnlineUsers();
    const nav = useNavigate();
    const notifications = useNotifications();

    const isChatRoom = !!chatId;

    const [chats, setChats] = useState([]);
    const [messages, setMessages] = useState([]);
    const [pinned, setPinned] = useState(null);
    const [myRole, setMyRole] = useState('member');
    const [firstUnreadId, setFirstUnreadId] = useState(null);
    const [text, setText] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const [forwarding, setForwarding] = useState(null);
    const [editing, setEditing] = useState(null);
    const [typingUsers, setTypingUsers] = useState([]);

    const [search, setSearch] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);

    const [uploading, setUploading] = useState(false);
    const [viewerIndex, setViewerIndex] = useState(null);
    const [showMembers, setShowMembers] = useState(false);
    const [showGallery, setShowGallery] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const [highlightId, setHighlightId] = useState(null);
    const [mentionQuery, setMentionQuery] = useState(null);
    const [chatMenu, setChatMenu] = useState(null);
    const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
    const [panel, setPanel] = useState(null);
    const [attachMenu, setAttachMenu] = useState(false);

    const [recording, setRecording] = useState(false);
    const [recordingSec, setRecordingSec] = useState(0);
    const mediaRecorderRef = useRef(null);
    const recChunksRef = useRef([]);
    const recMimeRef = useRef('audio/webm');
    const recTimerRef = useRef(null);

    const scrollRef = useRef(null);
    const typingTimeout = useRef(null);
    const fileRef = useRef(null);
    const mediaFileRef = useRef(null);
    const textareaRef = useRef(null);
    const needsInitialScroll = useRef(false);

    const activeChat = chats.find((c) => c.id === chatId);
    const chatTitle = useMemo(() => {
        if (!activeChat) return '';
        if (activeChat.type === 'GROUP') return activeChat.title;
        const other = activeChat.members.find((m) => m.id !== user.id);
        return other?.fullName || 'Чат';
    }, [activeChat, user.id]);

    const imageMessages = useMemo(
        () =>
            messages
                .filter((m) => m.type === 'image' && !m.deletedAt)
                .map((m) => ({ id: m.id, url: resolveUrl(m.content) })),
        [messages]
    );

    const openViewer = (id) => {
        const idx = imageMessages.findIndex((i) => i.id === id);
        if (idx >= 0) setViewerIndex(idx);
    };

    const goProfile = (username) => {
        if (username) nav(`/app/u/${username}`);
    };

    const scrollToMessage = (id) => {
        const el = document.getElementById(`msg-${id}`);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightId(id);
        setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 1800);
    };

    const reloadChats = () => {
        if (!token) return;
        api('/chats', { token }).then(setChats).catch(() => {});
    };

    useEffect(() => {
        reloadChats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, chatId]);

    useEffect(() => {
        if (!chatId || !token) return;

        setFirstUnreadId(null);
        needsInitialScroll.current = true;

        api(`/chats/${chatId}/messages`, { token }).then((r) => {
            if (Array.isArray(r)) {
                setMessages(r);
                setPinned(null);
                setMyRole('member');
            } else {
                setMessages(r.messages || []);
                setPinned(r.pinned || null);
                setMyRole(r.myRole || 'member');
                setFirstUnreadId(r.firstUnreadId || null);
            }
        });

        socket?.emit('chat:join', chatId);
        notifications.markChatRead?.(chatId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatId, token, socket]);

    useEffect(() => {
        if (!socket) return;

        const onNew = (m) => {
            if (m.chatId === chatId) setMessages((prev) => [...prev, m]);
            reloadChats();
        };
        const onEdited = (m) =>
            setMessages((p) => p.map((x) => (x.id === m.id ? m : x)));
        const onDeleted = ({ messageId }) => {
            setMessages((p) =>
                p.map((x) =>
                    x.id === messageId
                        ? { ...x, deletedAt: new Date().toISOString(), content: '' }
                        : x
                )
            );
            setPinned((cur) => (cur?.id === messageId ? null : cur));
        };
        const onReaction = ({ messageId, emoji, userId, action }) => {
            setMessages((prev) =>
                prev.map((m) => {
                    if (m.id !== messageId) return m;
                    const reactions = [...(m.reactions || [])];
                    if (action === 'added') reactions.push({ messageId, emoji, userId });
                    else {
                        const i = reactions.findIndex(
                            (r) => r.emoji === emoji && r.userId === userId
                        );
                        if (i >= 0) reactions.splice(i, 1);
                    }
                    return { ...m, reactions };
                })
            );
        };
        const onTyping = ({ chatId: cid, userId: uid, isTyping }) => {
            if (cid !== chatId || uid === user.id) return;
            setTypingUsers((prev) =>
                isTyping ? [...new Set([...prev, uid])] : prev.filter((x) => x !== uid)
            );
        };
        const onPinned = ({ chatId: cid, message }) => {
            if (cid === chatId) setPinned(message);
        };
        const onChatDeleted = ({ chatId: cid }) => {
            setChats((prev) => prev.filter((c) => c.id !== cid));
            if (chatId === cid) nav('/app/chats');
        };
        const onChatUpdated = () => reloadChats();

        socket.on('message:new', onNew);
        socket.on('message:edited', onEdited);
        socket.on('message:deleted', onDeleted);
        socket.on('reaction:update', onReaction);
        socket.on('typing', onTyping);
        socket.on('chat:pinned', onPinned);
        socket.on('chat:deleted', onChatDeleted);
        socket.on('chat:updated', onChatUpdated);

        return () => {
            socket.off('message:new', onNew);
            socket.off('message:edited', onEdited);
            socket.off('message:deleted', onDeleted);
            socket.off('reaction:update', onReaction);
            socket.off('typing', onTyping);
            socket.off('chat:pinned', onPinned);
            socket.off('chat:deleted', onChatDeleted);
            socket.off('chat:updated', onChatUpdated);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket, chatId, token, user.id]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        if (needsInitialScroll.current && messages.length > 0) {
            requestAnimationFrame(() => {
                if (firstUnreadId) {
                    const target = document.getElementById(`msg-${firstUnreadId}`);
                    if (target) {
                        el.scrollTop = Math.max(0, target.offsetTop - 40);
                        setHighlightId(firstUnreadId);
                        setTimeout(
                            () => setHighlightId((cur) => (cur === firstUnreadId ? null : cur)),
                            1800
                        );
                    } else {
                        el.scrollTop = el.scrollHeight;
                    }
                } else {
                    el.scrollTop = el.scrollHeight;
                }
            });
            needsInitialScroll.current = false;
            return;
        }

        if (messages.length > 0 && !needsInitialScroll.current) {
            el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }
    }, [messages.length, firstUnreadId]);

    useEffect(() => {
        setShowMembers(false);
        setContextMenu(null);
        setMentionQuery(null);
        setChatMenu(null);
        setHeaderMenuOpen(false);
        setPanel(null);
        setAttachMenu(false);
        setSearchOpen(false);
        setSearch('');
    }, [chatId]);

    const send = () => {
        if (!text.trim() || !chatId) return;
        if (editing) {
            socket.emit('message:edit', { messageId: editing.id, content: text });
            setEditing(null);
        } else {
            socket.emit('message:send', {
                chatId,
                content: text,
                type: 'text',
                replyToId: replyTo?.id,
            });
        }
        setText('');
        setReplyTo(null);
        setPanel(null);
        setMentionQuery(null);
    };

    const sendSticker = (id) => {
        socket.emit('message:send', {
            chatId,
            content: id,
            type: 'sticker',
            replyToId: replyTo?.id,
        });
        setReplyTo(null);
        setPanel(null);
    };

    const sendFile = async (file, type) => {
        if (!file || !chatId) return;
        setUploading(true);
        try {
            const res = await uploadFile(file, token);
            socket.emit('message:send', {
                chatId,
                content: res.url,
                type,
                replyToId: replyTo?.id,
            });
            setReplyTo(null);
        } catch (e) {
            alert(e.message);
        } finally {
            setUploading(false);
        }
    };

    const sendImage = (f) => sendFile(f, 'image');
    const sendVideo = (f) => sendFile(f, 'video');
    const sendDoc = (f) => sendFile(f, 'file');

    const startRecording = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            alert('Ваш браузер не поддерживает запись звука');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                    sampleRate: 48000,
                    sampleSize: 16,
                },
            });

            const mimeType = pickAudioMime();
            const opts = { audioBitsPerSecond: 128000 };
            if (mimeType) opts.mimeType = mimeType;

            let mr;
            try {
                mr = new MediaRecorder(stream, opts);
            } catch {
                mr = new MediaRecorder(stream);
            }

            mediaRecorderRef.current = mr;
            recChunksRef.current = [];
            recMimeRef.current = mr.mimeType || mimeType || 'audio/webm';

            mr.ondataavailable = (e) => {
                if (e.data.size > 0) recChunksRef.current.push(e.data);
            };
            mr.onstop = async () => {
                stream.getTracks().forEach((t) => t.stop());
                const blob = new Blob(recChunksRef.current, { type: recMimeRef.current });
                if (blob.size < 1000) return;
                const ext = extFromMime(recMimeRef.current);
                const file = new File([blob], `voice-${Date.now()}.${ext}`, {
                    type: recMimeRef.current,
                });
                await sendFile(file, 'voice');
            };

            mr.start(1000);
            setRecording(true);
            setRecordingSec(0);
            recTimerRef.current = setInterval(
                () => setRecordingSec((s) => s + 1),
                1000
            );
        } catch (e) {
            alert('Не удалось получить доступ к микрофону: ' + e.message);
        }
    };

    const stopRecording = (cancel = false) => {
        const mr = mediaRecorderRef.current;
        if (!mr) return;
        clearInterval(recTimerRef.current);
        setRecording(false);
        if (cancel) {
            mr.ondataavailable = null;
            mr.onstop = null;
        }
        mr.stop();
    };

    const handleChange = (e) => {
        const value = e.target.value;
        const pos = e.target.selectionStart || 0;
        setText(value);

        const before = value.slice(0, pos);
        const m = before.match(/(^|[\s(])@([a-z0-9_]{0,20})$/i);
        if (m) setMentionQuery({ start: pos - m[2].length - 1, query: m[2] });
        else setMentionQuery(null);

        if (!socket || !chatId) return;
        socket.emit('typing', { chatId, isTyping: true });
        clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(
            () => socket.emit('typing', { chatId, isTyping: false }),
            1200
        );
    };

    const applyMention = (member) => {
        if (!mentionQuery) return;
        const before = text.slice(0, mentionQuery.start);
        const after = text.slice(mentionQuery.start + mentionQuery.query.length + 1);
        setText(`${before}@${member.username} ${after}`);
        setMentionQuery(null);
        textareaRef.current?.focus();
    };

    const toggleReaction = (id, emoji) =>
        socket.emit('reaction:toggle', { messageId: id, emoji });

    const toggleSearch = () => {
        if (searchOpen) {
            setSearch('');
            setSearchOpen(false);
        } else {
            setSearchOpen(true);
        }
    };

    const doForward = (target) => {
        socket.emit('message:send', {
            chatId: target,
            content: forwarding.content,
            type: forwarding.type,
            forwardedFrom: {
                userId: forwarding.sender.id,
                fullName: forwarding.sender.fullName,
            },
        });
        setForwarding(null);
        nav(`/app/chats/${target}`);
    };

    const pinMessage = async (m) => {
        try {
            const r = await api(`/chats/${chatId}/pin`, {
                method: 'POST',
                token,
                body: { messageId: m.id },
            });
            setPinned(r.message);
        } catch (e) {
            alert(e.message);
        }
    };

    const unpinMessage = async () => {
        try {
            await api(`/chats/${chatId}/pin`, { method: 'DELETE', token });
            setPinned(null);
        } catch (e) {
            alert(e.message);
        }
    };

    const deleteChat = async (chat) => {
        if (!chat) return;
        const isGroup = chat.type === 'GROUP';
        const isAdmin =
            chat.myRole === 'admin' ||
            chat.members?.find((m) => m.id === user.id)?.role === 'admin';
        let confirmText;
        if (isGroup && isAdmin) confirmText = `Удалить группу «${chat.title}» для всех?`;
        else if (isGroup) confirmText = `Покинуть группу «${chat.title}»?`;
        else confirmText = `Удалить чат? Он исчезнет только у вас.`;
        if (!confirm(confirmText)) return;
        try {
            await api(`/chats/${chat.id}`, { method: 'DELETE', token });
            setChats((prev) => prev.filter((c) => c.id !== chat.id));
            if (chatId === chat.id) nav('/app/chats');
        } catch (e) {
            alert(e.message);
        }
    };

    const contextActions = (m) => {
        const isOwn = m.sender.id === user.id;
        const canPin =
            activeChat?.type === 'GROUP'
                ? activeChat.members.find((x) => x.id === user.id)?.role === 'admin' ||
                !activeChat.members.find((x) => x.id === user.id)?.role
                : true;

        const actions = [
            { id: 'react', label: '❤️ Реакция' },
            { id: 'reply', label: '↩ Ответить' },
            { id: 'copy', label: '📋 Копировать', only: m.type === 'text' },
            { id: 'forward', label: '↪ Переслать' },
            { id: 'pin', label: '📌 Закрепить', only: !m.deletedAt && canPin },
            { id: 'edit', label: '✏️ Изменить', only: isOwn && m.type === 'text' && !m.deletedAt },
            { id: 'delete', label: '🗑️ Удалить', only: isOwn && !m.deletedAt, danger: true },
        ].filter((a) => a.only === undefined || a.only);

        const handler = (id) => {
            setContextMenu(null);
            switch (id) {
                case 'react': toggleReaction(m.id, '❤️'); break;
                case 'reply': setReplyTo(m); break;
                case 'copy': navigator.clipboard?.writeText(m.content); break;
                case 'forward': setForwarding(m); break;
                case 'pin': pinMessage(m); break;
                case 'edit': setEditing(m); setText(m.content); break;
                case 'delete':
                    if (confirm('Удалить сообщение?'))
                        socket.emit('message:delete', { messageId: m.id });
                    break;
            }
        };
        return { actions, handler };
    };

    const filteredChats = chats.filter((c) => {
        const name =
            c.type === 'GROUP' ? c.title : c.members.find((m) => m.id !== user.id)?.fullName;
        return !search || name?.toLowerCase().includes(search.toLowerCase());
    });

    const chatMembers = activeChat?.members || [];
    const isActiveGroup = activeChat?.type === 'GROUP';
    const isActiveGroupAdmin = isActiveGroup && myRole === 'admin';
    const deleteLabel = isActiveGroup
        ? isActiveGroupAdmin
            ? '🗑️ Удалить группу'
            : '🚪 Покинуть группу'
        : '🗑️ Удалить чат';

    return (
        <div
            className={
                isChatRoom
                    ? 'fixed inset-0 md:left-64 z-40 flex overflow-hidden bg-ink-900'
                    : 'flex'
            }
            style={
                isChatRoom
                    ? {
                        paddingTop: 'env(safe-area-inset-top, 0px)',
                        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                    }
                    : undefined
            }
            onClick={() => {
                if (contextMenu) setContextMenu(null);
                if (chatMenu) setChatMenu(null);
                if (headerMenuOpen) setHeaderMenuOpen(false);
                if (attachMenu) setAttachMenu(false);
            }}
        >
            {/* ───────── Список чатов ───────── */}
            <aside
                className={`${
                    chatId ? 'hidden md:flex' : 'flex'
                } md:w-80 w-full flex-col border-r border-white/5 bg-ink-800/50 min-h-0`}
            >
                <div className="p-4 border-b border-white/5 shrink-0">
                    <div className="flex items-center gap-1">
                        <h2 className="text-xl font-bold">Чаты</h2>
                        <button
                            type="button"
                            onClick={toggleSearch}
                            className={`ml-auto btn-ghost !p-2 text-base ${
                                searchOpen ? 'bg-white/10' : ''
                            }`}
                            title={searchOpen ? 'Закрыть поиск' : 'Поиск'}
                            aria-label={searchOpen ? 'Закрыть поиск' : 'Поиск'}
                            aria-expanded={searchOpen}
                        >
                            🔍
                        </button>
                        <NewChatButton onCreated={(id) => nav(`/app/chats/${id}`)} />
                    </div>

                    {searchOpen && (
                        <div className="relative mt-3">
                            <input
                                autoFocus
                                className="input pr-10"
                                placeholder="Поиск…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 text-white/60 text-xs transition"
                                    aria-label="Очистить"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar min-h-0">
                    {filteredChats.map((c) => {
                        const other = c.members.find((m) => m.id !== user.id);
                        const title = c.type === 'GROUP' ? c.title : other?.fullName;
                        const otherOnline =
                            c.type !== 'GROUP' && other && onlineUsers.has(other.id);
                        return (
                            <div
                                key={c.id}
                                className="relative group"
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    setChatMenu({ x: e.clientX, y: e.clientY, chat: c });
                                }}
                            >
                                <button
                                    onClick={() => nav(`/app/chats/${c.id}`)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition ${
                                        c.id === chatId ? 'bg-white/5' : ''
                                    }`}
                                >
                                    {c.type === 'GROUP' ? (
                                        <GroupAvatar members={c.members} onlineSet={onlineUsers} />
                                    ) : (
                                        <Avatar user={other} size={46} online={otherOnline} />
                                    )}
                                    <div className="flex-1 min-w-0 text-left">
                                        <div className="font-semibold truncate">{title}</div>
                                        <div className="text-xs text-white/40 truncate">
                                            {c.lastMessage?.type === 'sticker'
                                                ? '🎨 Стикер'
                                                : c.lastMessage?.type === 'image'
                                                    ? '🖼️ Изображение'
                                                    : c.lastMessage?.type === 'video'
                                                        ? '🎥 Видео'
                                                        : c.lastMessage?.type === 'voice'
                                                            ? '🎤 Голосовое'
                                                            : c.lastMessage?.type === 'file'
                                                                ? '📎 Файл'
                                                                : c.lastMessage?.content || 'Нет сообщений'}
                                        </div>
                                    </div>
                                    {c.unread > 0 && (
                                        <span className="chip bg-pink text-white">new</span>
                                    )}
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const r = e.currentTarget.getBoundingClientRect();
                                        setChatMenu({ x: r.right, y: r.bottom, chat: c });
                                    }}
                                    className="hidden md:grid place-items-center absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-ink-700/90 hover:bg-ink-600 text-white/60 opacity-0 group-hover:opacity-100 transition"
                                >
                                    ⋯
                                </button>
                            </div>
                        );
                    })}
                    {filteredChats.length === 0 && search && (
                        <div className="p-6 text-center text-white/30 text-sm">
                            Ничего не найдено
                        </div>
                    )}
                </div>
            </aside>

            {/* ───────── Активный чат ───────── */}
            <section
                className={`${
                    chatId ? 'flex' : 'hidden md:flex'
                } flex-1 flex-col min-w-0 relative min-h-0`}
            >
                {!chatId ? (
                    <div className="flex-1 grid place-items-center text-white/30">
                        <div className="text-center">
                            <div className="text-6xl mb-3">💬</div>
                            <p>Выбери чат слева</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <header className="p-3 border-b border-white/5 flex items-center gap-2 shrink-0">
                            <button
                                className="md:hidden btn-ghost !p-2"
                                onClick={() => nav('/app/chats')}
                                title="К списку чатов"
                                aria-label="Назад к списку чатов"
                            >
                                ←
                            </button>

                            <button
                                onClick={() =>
                                    activeChat?.type === 'GROUP' && setShowMembers((v) => !v)
                                }
                                className="flex items-center gap-3 min-w-0 flex-1 text-left hover:opacity-90"
                            >
                                {activeChat?.type === 'GROUP' ? (
                                    <GroupAvatar members={activeChat.members} onlineSet={onlineUsers} />
                                ) : (
                                    <Avatar
                                        user={activeChat?.members.find((m) => m.id !== user.id)}
                                        size={40}
                                        online={onlineUsers.has(
                                            activeChat?.members.find((m) => m.id !== user.id)?.id
                                        )}
                                    />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold truncate">{chatTitle}</div>
                                    <div className="text-xs text-white/40">
                                        {typingUsers.length > 0
                                            ? 'печатает…'
                                            : activeChat?.type === 'GROUP'
                                                ? `${activeChat.members.length} участников · ${
                                                    activeChat.members.filter((m) => onlineUsers.has(m.id))
                                                        .length
                                                } в сети`
                                                : onlineUsers.has(
                                                    activeChat?.members.find((m) => m.id !== user.id)?.id
                                                )
                                                    ? 'в сети'
                                                    : 'не в сети'}
                                    </div>
                                </div>
                            </button>

                            <button
                                className="btn-ghost !p-2"
                                onClick={() => setShowGallery(true)}
                                title="Медиа и файлы"
                            >
                                🖼️
                            </button>

                            <button
                                className={`btn-ghost !p-2 ${showMembers ? 'bg-white/10' : ''}`}
                                onClick={() => setShowMembers((v) => !v)}
                                title="Участники"
                            >
                                ℹ️
                            </button>

                            <div className="relative">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setHeaderMenuOpen((v) => !v);
                                    }}
                                    className={`btn-ghost !p-2 ${headerMenuOpen ? 'bg-white/10' : ''}`}
                                >
                                    ⋯
                                </button>
                                {headerMenuOpen && (
                                    <div
                                        className="absolute right-0 top-full mt-2 z-30 card p-1 w-56 animate-pop"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <button
                                            onClick={() => {
                                                setHeaderMenuOpen(false);
                                                deleteChat(activeChat);
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5 text-pink"
                                        >
                                            {deleteLabel}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </header>

                        <PinnedBar
                            message={pinned}
                            onUnpin={unpinMessage}
                            onJump={() => pinned && scrollToMessage(pinned.id)}
                        />

                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto px-3 md:px-6 py-4 space-y-2 min-h-0"
                        >
                            {messages.map((m) => (
                                <MessageBubble
                                    key={m.id}
                                    m={m}
                                    isOwn={m.sender.id === user.id}
                                    highlight={highlightId === m.id}
                                    onlineSet={onlineUsers}
                                    onReply={() => setReplyTo(m)}
                                    onEdit={() => {
                                        setEditing(m);
                                        setText(m.content);
                                    }}
                                    onDelete={() =>
                                        socket.emit('message:delete', { messageId: m.id })
                                    }
                                    onForward={() => setForwarding(m)}
                                    onReact={(emoji) => toggleReaction(m.id, emoji)}
                                    onOpenImage={() => openViewer(m.id)}
                                    onOpenProfile={() => goProfile(m.sender.username)}
                                    onScrollToReply={(id) => scrollToMessage(id)}
                                    onLongPress={(e) => {
                                        const { clientX, clientY } = e.touches?.[0] || e;
                                        setContextMenu({ x: clientX, y: clientY, message: m });
                                    }}
                                />
                            ))}
                        </div>

                        <div className="border-t border-white/5 p-2 md:p-3 space-y-2 shrink-0 bg-ink-900/95 backdrop-blur relative">
                            {replyTo && (
                                <div className="flex items-center gap-2 bg-ink-700/60 rounded-2xl px-3 py-2 text-sm">
                                    <div className="w-1 h-8 rounded bg-violet" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-violet-soft text-xs font-bold">
                                            Ответ {replyTo.sender.fullName}
                                        </div>
                                        <div className="text-white/60 truncate">
                                            {replyTo.type === 'image'
                                                ? '🖼️ Изображение'
                                                : replyTo.type === 'video'
                                                    ? '🎥 Видео'
                                                    : replyTo.type === 'voice'
                                                        ? '🎤 Голосовое'
                                                        : replyTo.type === 'file'
                                                            ? '📎 Файл'
                                                            : replyTo.content}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setReplyTo(null)}
                                        className="text-white/40"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}

                            {editing && (
                                <div className="flex items-center gap-2 bg-cyan/10 rounded-2xl px-3 py-2 text-sm text-cyan-soft">
                                    ✏️ Редактирование
                                    <button
                                        onClick={() => {
                                            setEditing(null);
                                            setText('');
                                        }}
                                        className="ml-auto"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}

                            {recording ? (
                                <div className="flex items-center gap-3 bg-pink/10 border border-pink/30 rounded-2xl px-3 py-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-pink animate-pulse" />
                                    <div className="flex-1">
                                        <div className="text-sm text-pink">Запись голосового…</div>
                                        <div className="text-xs text-white/50">
                                            {recordingSec} сек
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => stopRecording(true)}
                                        className="btn-ghost !py-1.5 !px-3 text-xs text-white/70"
                                    >
                                        Отмена
                                    </button>
                                    <button
                                        onClick={() => stopRecording(false)}
                                        className="btn-primary !py-1.5 !px-3 text-xs"
                                    >
                                        Отправить ➤
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-end gap-1.5 md:gap-2">
                                    <div className="relative shrink-0">
                                        <button
                                            className="btn-ghost !p-2.5 md:!p-3 text-lg md:text-xl"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setAttachMenu((v) => !v);
                                                setPanel(null);
                                            }}
                                            disabled={uploading}
                                            title="Прикрепить"
                                        >
                                            {uploading ? '⏳' : '＋'}
                                        </button>
                                        {attachMenu && (
                                            <div
                                                className="absolute bottom-full left-0 mb-2 z-30 card p-1 w-56 animate-pop"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <button
                                                    onClick={() => {
                                                        setAttachMenu(false);
                                                        fileRef.current?.click();
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5 flex items-center gap-2"
                                                >
                                                    <span className="text-lg">📷</span>
                                                    <span>Фото / видео</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setAttachMenu(false);
                                                        mediaFileRef.current?.click();
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5 flex items-center gap-2"
                                                >
                                                    <span className="text-lg">📄</span>
                                                    <span>Документ</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept="image/*,video/*"
                                        hidden
                                        onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            e.target.value = '';
                                            if (!f) return;
                                            if (f.type.startsWith('video/')) sendVideo(f);
                                            else sendImage(f);
                                        }}
                                    />
                                    <input
                                        ref={mediaFileRef}
                                        type="file"
                                        hidden
                                        onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            e.target.value = '';
                                            if (f) sendDoc(f);
                                        }}
                                    />

                                    <button
                                        className={`btn-ghost !p-2.5 md:!p-3 text-lg md:text-xl shrink-0 ${
                                            panel ? 'bg-white/10' : ''
                                        }`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPanel((p) => (p ? null : 'emoji'));
                                            setAttachMenu(false);
                                        }}
                                        title="Эмодзи и стикеры"
                                    >
                                        😊
                                    </button>

                                    <textarea
                                        ref={textareaRef}
                                        rows={1}
                                        value={text}
                                        onChange={handleChange}
                                        onKeyDown={(e) => {
                                            if (mentionQuery) return;
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                send();
                                            }
                                        }}
                                        placeholder="Написать сообщение…"
                                        className="input flex-1 min-w-0 resize-none max-h-40 !py-2 md:!py-3 text-base"
                                        autoComplete="off"
                                    />

                                    {text.trim() ? (
                                        <button
                                            onClick={send}
                                            className="btn-primary !p-2.5 md:!p-3 text-lg md:text-xl shrink-0"
                                        >
                                            ➤
                                        </button>
                                    ) : (
                                        <button
                                            onClick={startRecording}
                                            className="btn-primary !p-2.5 md:!p-3 text-lg md:text-xl shrink-0"
                                            title="Голосовое сообщение"
                                        >
                                            🎤
                                        </button>
                                    )}
                                </div>
                            )}

                            {panel && (
                                <div
                                    className="card p-3 animate-pop"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="flex gap-2 mb-3">
                                        <button
                                            onClick={() => setPanel('emoji')}
                                            className={`chip ${
                                                panel === 'emoji'
                                                    ? 'bg-violet text-white'
                                                    : 'bg-white/5 text-white/60'
                                            }`}
                                        >
                                            😊 Эмодзи
                                        </button>
                                        <button
                                            onClick={() => setPanel('stickers')}
                                            className={`chip ${
                                                panel === 'stickers'
                                                    ? 'bg-violet text-white'
                                                    : 'bg-white/5 text-white/60'
                                            }`}
                                        >
                                            🎨 Стикеры
                                        </button>
                                    </div>

                                    {panel === 'emoji' && (
                                        <div className="grid grid-cols-6 gap-1">
                                            {QUICK_EMOJI.map((e) => (
                                                <button
                                                    key={e}
                                                    onClick={() => setText((t) => t + e)}
                                                    className="text-2xl hover:scale-125 transition"
                                                >
                                                    {e}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {panel === 'stickers' && (
                                        <div className="grid grid-cols-4 md:grid-cols-6 gap-2 max-h-64 overflow-y-auto no-scrollbar">
                                            {STICKERS.map((s) => (
                                                <button
                                                    key={s.id}
                                                    onClick={() => sendSticker(s.id)}
                                                    className="hover:scale-105 transition"
                                                >
                                                    <Sticker id={s.id} size={80} className="w-full h-auto" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {mentionQuery && chatMembers.length > 0 && (
                                <div className="absolute left-2 right-2 bottom-full mb-2">
                                    <MentionSuggest
                                        query={mentionQuery.query}
                                        members={chatMembers}
                                        onSelect={applyMention}
                                        onClose={() => setMentionQuery(null)}
                                    />
                                </div>
                            )}
                        </div>

                        {showMembers && activeChat && (
                            <>
                                <div
                                    className="absolute inset-0 bg-black/40 z-10"
                                    onClick={() => setShowMembers(false)}
                                />
                                <div className="absolute top-14 right-2 md:right-3 w-72 max-h-[70%] card z-20 p-3 flex flex-col animate-pop">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="font-bold text-sm">
                                            Участники · {activeChat.members.length}
                                        </div>
                                        <button
                                            onClick={() => setShowMembers(false)}
                                            className="text-white/40 hover:text-white"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    <div className="overflow-y-auto space-y-1 pr-1">
                                        {activeChat.members.map((m) => (
                                            <button
                                                key={m.id}
                                                onClick={() => {
                                                    setShowMembers(false);
                                                    goProfile(m.username);
                                                }}
                                                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 text-left"
                                            >
                                                <Avatar user={m} size={36} online={onlineUsers.has(m.id)} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-semibold truncate">
                                                        {m.fullName}
                                                        {m.role === 'admin' && (
                                                            <span className="ml-2 text-[10px] text-violet-soft uppercase">
                                                                админ
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-white/40 truncate">
                                                        @{m.username}
                                                        {onlineUsers.has(m.id) && (
                                                            <span className="text-lime ml-2">в сети</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}
            </section>

            {contextMenu &&
                (() => {
                    const { actions, handler } = contextActions(contextMenu.message);
                    const style = {
                        position: 'fixed',
                        left: Math.min(contextMenu.x, window.innerWidth - 200),
                        top: Math.min(
                            contextMenu.y,
                            window.innerHeight - 60 - actions.length * 44
                        ),
                        zIndex: 80,
                    };
                    return (
                        <>
                            <div
                                className="fixed inset-0 z-[70]"
                                onClick={() => setContextMenu(null)}
                            />
                            <div className="card p-1 w-48 animate-pop" style={style}>
                                {actions.map((a) => (
                                    <button
                                        key={a.id}
                                        onClick={() => handler(a.id)}
                                        className={`w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5 ${
                                            a.danger ? 'text-pink' : ''
                                        }`}
                                    >
                                        {a.label}
                                    </button>
                                ))}
                            </div>
                        </>
                    );
                })()}

            {chatMenu &&
                (() => {
                    const c = chatMenu.chat;
                    const isGroup = c.type === 'GROUP';
                    const isAdmin = c.myRole === 'admin';
                    const label = isGroup
                        ? isAdmin
                            ? '🗑️ Удалить группу'
                            : '🚪 Покинуть группу'
                        : '🗑️ Удалить чат';
                    const style = {
                        position: 'fixed',
                        left: Math.min(chatMenu.x - 40, window.innerWidth - 220),
                        top: Math.min(chatMenu.y, window.innerHeight - 100),
                        zIndex: 80,
                    };
                    return (
                        <>
                            <div
                                className="fixed inset-0 z-[70]"
                                onClick={() => setChatMenu(null)}
                            />
                            <div className="card p-1 w-52 animate-pop" style={style}>
                                <button
                                    onClick={() => {
                                        setChatMenu(null);
                                        deleteChat(c);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5 text-pink"
                                >
                                    {label}
                                </button>
                            </div>
                        </>
                    );
                })()}

            {forwarding && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4"
                    onClick={() => setForwarding(null)}
                >
                    <div
                        className="card p-5 w-full max-w-md"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="font-bold mb-3">Переслать в…</div>
                        <div className="max-h-80 overflow-y-auto">
                            {chats
                                .filter((c) => c.id !== chatId)
                                .map((c) => {
                                    const other = c.members.find((m) => m.id !== user.id);
                                    return (
                                        <button
                                            key={c.id}
                                            onClick={() => doForward(c.id)}
                                            className="w-full flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl"
                                        >
                                            {c.type === 'GROUP' ? (
                                                <GroupAvatar members={c.members} onlineSet={onlineUsers} />
                                            ) : (
                                                <Avatar user={other} size={36} />
                                            )}
                                            <span className="font-semibold">
                                                {c.type === 'GROUP' ? c.title : other?.fullName}
                                            </span>
                                        </button>
                                    );
                                })}
                        </div>
                    </div>
                </div>
            )}

            {viewerIndex !== null && imageMessages.length > 0 && (
                <ImageViewer
                    images={imageMessages}
                    startIndex={viewerIndex}
                    onClose={() => setViewerIndex(null)}
                />
            )}

            {showGallery && chatId && (
                <MediaGalleryModal chatId={chatId} onClose={() => setShowGallery(false)} />
            )}
        </div>
    );
}

/* ─────────────── MessageBubble ─────────────── */

function MessageBubble({
                           m,
                           isOwn,
                           highlight,
                           onlineSet,
                           onReply,
                           onEdit,
                           onDelete,
                           onForward,
                           onReact,
                           onOpenImage,
                           onOpenProfile,
                           onScrollToReply,
                           onLongPress,
                       }) {
    const [showReactions, setShowReactions] = useState(false);
    const longPressTimer = useRef(null);
    const startPos = useRef(null);

    const grouped = (m.reactions || []).reduce((acc, r) => {
        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
        return acc;
    }, {});
    const forwarded = m.forwardedFrom ? JSON.parse(m.forwardedFrom) : null;

    const startLongPress = (e) => {
        const touch = e.touches?.[0];
        startPos.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
        clearTimeout(longPressTimer.current);
        longPressTimer.current = setTimeout(() => {
            if (m.deletedAt) return;
            onLongPress?.(e);
        }, 500);
    };

    const moveLongPress = (e) => {
        const touch = e.touches?.[0];
        if (!touch || !startPos.current) return;
        const dx = Math.abs(touch.clientX - startPos.current.x);
        const dy = Math.abs(touch.clientY - startPos.current.y);
        if (dx > 8 || dy > 8) clearTimeout(longPressTimer.current);
    };

    const endLongPress = () => {
        clearTimeout(longPressTimer.current);
        startPos.current = null;
    };

    const onCtx = (e) => {
        e.preventDefault();
        if (!m.deletedAt) onLongPress?.(e);
    };

    const highlights = useMemo(() => {
        const set = new Set();
        if (m.type === 'text' && m.content) {
            const re = /@([a-z0-9_]{3,20})/gi;
            let mm;
            while ((mm = re.exec(m.content)) !== null) set.add(mm[1].toLowerCase());
        }
        return set;
    }, [m.content, m.type]);

    const isMediaOnly = ['sticker', 'image', 'video'].includes(m.type);

    return (
        <div
            id={`msg-${m.id}`}
            className={`group flex gap-2 ${isOwn ? 'flex-row-reverse' : ''} rounded-2xl transition ${
                highlight ? 'bg-violet/20 ring-2 ring-violet/60' : ''
            }`}
        >
            {!isOwn && (
                <button
                    onClick={onOpenProfile}
                    className="shrink-0 hover:opacity-80 transition"
                    title={`Профиль @${m.sender.username}`}
                >
                    <Avatar user={m.sender} size={34} online={onlineSet?.has(m.sender.id)} />
                </button>
            )}
            <div
                className={`max-w-[80%] md:max-w-[65%] ${
                    isOwn ? 'items-end' : 'items-start'
                } flex flex-col`}
            >
                {!isOwn && (
                    <button
                        onClick={onOpenProfile}
                        className="text-xs text-white/40 px-2 mb-1 hover:text-white/70 transition text-left"
                    >
                        {m.sender.fullName}
                    </button>
                )}

                <div
                    onDoubleClick={() => onReact('❤️')}
                    onTouchStart={startLongPress}
                    onTouchMove={moveLongPress}
                    onTouchEnd={endLongPress}
                    onTouchCancel={endLongPress}
                    onContextMenu={onCtx}
                    className={`relative rounded-2xl px-3 py-2 select-none ${
                        isMediaOnly
                            ? 'bg-transparent !p-0'
                            : isOwn
                                ? 'text-white'
                                : 'bg-ink-700 text-white'
                    }`}
                    style={
                        isOwn && !isMediaOnly
                            ? { background: 'var(--brand-gradient)' }
                            : undefined
                    }
                >
                    {forwarded && (
                        <div className="text-xs opacity-70 mb-1 italic">
                            ↪ Переслано от {forwarded.fullName}
                        </div>
                    )}
                    {m.replyTo && (
                        <button
                            onClick={() => onScrollToReply?.(m.replyTo.id)}
                            className="block w-full text-left border-l-2 border-white/40 pl-2 mb-1 text-xs opacity-80 hover:opacity-100"
                        >
                            <div className="font-bold">{m.replyTo.sender?.fullName}</div>
                            <div className="truncate max-w-[200px]">
                                {m.replyTo.type === 'image'
                                    ? '🖼️ Изображение'
                                    : m.replyTo.type === 'video'
                                        ? '🎥 Видео'
                                        : m.replyTo.type === 'voice'
                                            ? '🎤 Голосовое'
                                            : m.replyTo.type === 'file'
                                                ? '📎 Файл'
                                                : m.replyTo.content}
                            </div>
                        </button>
                    )}

                    {m.deletedAt ? (
                        <div className="italic opacity-50 text-sm px-2">сообщение удалено</div>
                    ) : m.type === 'sticker' ? (
                        <Sticker id={m.content} size={120} />
                    ) : m.type === 'image' ? (
                        <button
                            type="button"
                            onClick={onOpenImage}
                            className="block rounded-2xl overflow-hidden hover:opacity-95 transition max-w-[240px] md:max-w-[300px]"
                        >
                            <img
                                src={resolveUrl(m.content)}
                                alt=""
                                className="block w-full h-auto object-cover"
                                loading="lazy"
                            />
                        </button>
                    ) : m.type === 'video' ? (
                        <div className="rounded-2xl overflow-hidden max-w-[280px] md:max-w-[340px] bg-black">
                            <video
                                src={resolveUrl(m.content)}
                                controls
                                className="block w-full h-auto"
                                preload="metadata"
                            />
                        </div>
                    ) : m.type === 'voice' ? (
                        <VoicePlayer src={m.content} isOwn={isOwn} />
                    ) : m.type === 'file' ? (
                        <a
                            href={resolveUrl(m.content)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/15 transition max-w-[240px]"
                        >
                            <div className="text-2xl">📎</div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold truncate">
                                    {decodeURIComponent((m.content || '').split('/').pop() || 'Файл')}
                                </div>
                                <div className="text-[10px] opacity-60">Скачать</div>
                            </div>
                        </a>
                    ) : (
                        <MessageText text={m.content} highlights={highlights} />
                    )}

                    {m.editedAt && !m.deletedAt && (
                        <span className="text-[10px] opacity-60 ml-1">(изм.)</span>
                    )}

                    {Object.keys(grouped).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(grouped).map(([emoji, count]) => (
                                <button
                                    key={emoji}
                                    onClick={() => onReact(emoji)}
                                    className={`text-xs rounded-full px-2 py-0.5 ${
                                        isOwn ? 'bg-black/20' : 'bg-white/10'
                                    } hover:bg-white/20`}
                                >
                                    {emoji} {count > 1 && count}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="text-[10px] text-white/30 px-2 mt-1">
                    {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </div>

                <div className="hidden md:group-hover:flex gap-1 mt-1">
                    <button
                        onClick={() => setShowReactions(!showReactions)}
                        className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10"
                    >
                        😊
                    </button>
                    <button
                        onClick={onReply}
                        className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10"
                    >
                        ↩
                    </button>
                    <button
                        onClick={onForward}
                        className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10"
                    >
                        ↪
                    </button>
                    {isOwn && !m.deletedAt && m.type === 'text' && (
                        <>
                            <button
                                onClick={onEdit}
                                className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10"
                            >
                                ✏️
                            </button>
                            <button
                                onClick={onDelete}
                                className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10"
                            >
                                🗑️
                            </button>
                        </>
                    )}
                    {isOwn && !m.deletedAt && m.type !== 'text' && (
                        <button
                            onClick={onDelete}
                            className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10"
                        >
                            🗑️
                        </button>
                    )}
                </div>

                {showReactions && (
                    <div className="flex gap-1 mt-1 animate-pop">
                        {QUICK_EMOJI.slice(0, 6).map((e) => (
                            <button
                                key={e}
                                onClick={() => {
                                    onReact(e);
                                    setShowReactions(false);
                                }}
                                className="text-xl hover:scale-125 transition"
                            >
                                {e}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─────────────── ImageViewer ─────────────── */

function ImageViewer({ images, startIndex, onClose }) {
    const [index, setIndex] = useState(startIndex);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft')
                setIndex((i) => (i - 1 + images.length) % images.length);
            if (e.key === 'ArrowRight')
                setIndex((i) => (i + 1) % images.length);
        };
        window.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [images.length, onClose]);

    const current = images[index];
    const prev = () => setIndex((i) => (i - 1 + images.length) % images.length);
    const next = () => setIndex((i) => (i + 1) % images.length);

    return (
        <div
            className="fixed inset-0 z-[120] bg-black/95 flex flex-col animate-pop"
            onClick={onClose}
        >
            <div
                className="flex items-center justify-between p-3 md:p-4 text-white shrink-0"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="text-sm opacity-70">
                    {index + 1} / {images.length}
                </div>
                <button
                    onClick={onClose}
                    className="text-2xl opacity-70 hover:opacity-100 w-9 h-9 grid place-items-center"
                >
                    ✕
                </button>
            </div>
            <div
                className="flex-1 relative flex items-center justify-center px-2 md:px-12 pb-4 min-h-0"
                onClick={(e) => e.stopPropagation()}
            >
                {images.length > 1 && (
                    <button
                        onClick={prev}
                        className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl grid place-items-center"
                    >
                        ‹
                    </button>
                )}
                <img
                    src={current.url}
                    alt=""
                    className="max-h-full max-w-full rounded-2xl object-contain select-none"
                    onClick={(e) => e.stopPropagation()}
                />
                {images.length > 1 && (
                    <button
                        onClick={next}
                        className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl grid place-items-center"
                    >
                        ›
                    </button>
                )}
            </div>
        </div>
    );
}

/* ─────────────── GroupAvatar ─────────────── */

function GroupAvatar({ members = [], size = 46, onlineSet }) {
    const shown = members.slice(0, 4);
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <div className="grid grid-cols-2 gap-0.5 w-full h-full rounded-full overflow-hidden ring-2 ring-white/10">
                {shown.map((m) => (
                    <Avatar key={m.id} user={m} size={size / 2} online={onlineSet?.has(m.id)} />
                ))}
            </div>
        </div>
    );
}

/* ─────────────── NewChatButton ─────────────── */

function NewChatButton({ onCreated }) {
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
        const chat = await api('/chats/direct', {
            method: 'POST',
            token,
            body: { userId },
        });
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

    /*
     * Модалка рендерится через createPortal в document.body.
     * Это устраняет любые проблемы с containing block (transform,
     * will-change: transform и т. п.) у родительских элементов:
     * fixed inset-0 гарантированно покрывает весь viewport,
     * и тап по пустому месту всегда закрывает модалку.
     */
    const modal = open
        ? createPortal(
            <div
                className="fixed inset-0 z-[100] bg-black/60 grid place-items-center p-4"
                onClick={() => setOpen(false)}
            >
                <div
                    className="card p-5 w-full max-w-md"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="font-bold text-lg">Новый чат</div>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="w-9 h-9 grid place-items-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition text-xl"
                            title="Закрыть"
                            aria-label="Закрыть"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => setTab('direct')}
                            className={`chip ${
                                tab === 'direct' ? 'bg-violet text-white' : 'bg-white/5'
                            }`}
                        >
                            Личный
                        </button>
                        <button
                            onClick={() => setTab('group')}
                            className={`chip ${
                                tab === 'group' ? 'bg-pink text-white' : 'bg-white/5'
                            }`}
                        >
                            Группа
                        </button>
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
                        {users
                            .filter((u) => u.id !== user.id)
                            .map((u) => (
                                <button
                                    key={u.id}
                                    onClick={() =>
                                        tab === 'direct'
                                            ? createDirect(u.id)
                                            : setSelected((s) =>
                                                s.includes(u.id)
                                                    ? s.filter((x) => x !== u.id)
                                                    : [...s, u.id]
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
                        >
                            Создать группу
                        </button>
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
                aria-label="Новый чат"
            >
                ＋
            </button>
            {modal}
        </>
    );
}