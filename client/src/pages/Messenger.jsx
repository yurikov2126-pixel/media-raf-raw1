import AttachmentPreview from '../components/messenger/AttachmentPreview.jsx';
import { uploadFileWithProgress } from '../api/client.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api, uploadFile, resolveUrl } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import { useSocket, useOnlineUsers } from '../store/socket.jsx';
import { useNotifications } from '../store/notifications.jsx';
import Avatar from '../components/Avatar.jsx';
import MentionSuggest from '../components/MentionSuggest.jsx';
import PinnedBar from '../components/PinnedBar.jsx';
import MediaGalleryModal from '../components/MediaGalleryModal.jsx';
import ImageViewer from '../components/ImageViewer.jsx';
import MessageBubble from '../components/messenger/MessageBubble.jsx';
import GroupAvatar from '../components/messenger/GroupAvatar.jsx';
import NewChatButton from '../components/messenger/NewChatButton.jsx';
import ReportButton from '../components/ReportButton.jsx';
import PullToRefreshIndicator from '../components/PullToRefreshIndicator.jsx';
import usePullToRefresh from '../hooks/usePullToRefresh.js';
import usePageMeta from '../hooks/usePageMeta.js';
import { STICKERS, Sticker, QUICK_EMOJI } from '../stickers/pack.jsx';

function pickAudioMime() {
    if (typeof MediaRecorder === 'undefined') return null;
    const candidates = [
        'audio/webm;codecs=opus', 'audio/webm',
        'audio/ogg;codecs=opus', 'audio/ogg',
        'audio/mp4;codecs=mp4a.40.2', 'audio/mp4',
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

// Group messages by the user's local calendar day, not by UTC date.
function messageDayKey(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function messageDayLabel(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const today = new Date();
    if (messageDayKey(date) === messageDayKey(today)) return 'Сегодня';
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (messageDayKey(date) === messageDayKey(yesterday)) return 'Вчера';
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

const TYPING_TTL_MS = 3000;

export default function Messenger() {
    const { chatId } = useParams();
    const [urlParams] = useSearchParams();
    const linkedMessageId = urlParams.get('message');
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
    const [typingUsers, setTypingUsers] = useState([]);       // для открытого чата
    const [typingByChat, setTypingByChat] = useState({});     // для списка чатов
    const [search, setSearch] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [chatFilter, setChatFilter] = useState('all');
    const [messageSearchOpen, setMessageSearchOpen] = useState(false);
    const [messageQuery, setMessageQuery] = useState('');
    const [messageMatchIndex, setMessageMatchIndex] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [pendingFiles, setPendingFiles] = useState([]);
    const [attachmentCaptions, setAttachmentCaptions] = useState({});
    const [attachmentProgress, setAttachmentProgress] = useState(0);
    const [attachmentIndex, setAttachmentIndex] = useState(0);
    const attachmentRetriesRef = useRef(new Map());
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
    const [reportTarget, setReportTarget] = useState(null);

    const [recording, setRecording] = useState(false);
    const [recordingSec, setRecordingSec] = useState(0);
    const mediaRecorderRef = useRef(null);
    const recChunksRef = useRef([]);
    const recMimeRef = useRef('audio/webm');
    const recTimerRef = useRef(null);

    const scrollRef = useRef(null);
    const nearBottomRef = useRef(true);
    const [showJumpToLatest, setShowJumpToLatest] = useState(false);
    const [unseenCount, setUnseenCount] = useState(0);
    const chatListScrollRef = useRef(null);
    const typingTimeout = useRef(null);
    const typingClearTimers = useRef(new Map()); // key: chatId:userId
    const fileRef = useRef(null);
    const mediaFileRef = useRef(null);
    const textareaRef = useRef(null);
    const needsInitialScroll = useRef(false);
    const mediaFollowChatRef = useRef(null);

    const activeChat = chats.find((c) => c.id === chatId);
    const chatTitle = useMemo(() => {
        if (!activeChat) return '';
        if (activeChat.type === 'GROUP') return activeChat.title;
        const other = activeChat.members.find((m) => m.id !== user.id);
        return other?.fullName || 'Чат';
    }, [activeChat, user.id]);

    usePageMeta({
        title: chatTitle ? `💬 ${chatTitle}` : 'Чаты',
        description: chatTitle
            ? `Переписка с ${chatTitle}`
            : 'Мессенджер MEDIA·RAF·RAW',
    });

    const imageMessages = useMemo(
        () => messages.filter((m) => m.type === 'image' && !m.deletedAt)
            .map((m) => ({ id: m.id, url: resolveUrl(m.content) })),
        [messages]
    );

    const messageMatches = useMemo(() => {
        const query = messageQuery.trim().toLocaleLowerCase('ru');
        if (!query) return [];
        return messages.filter((m) => !m.deletedAt && m.type === 'text' &&
            String(m.content || '').toLocaleLowerCase('ru').includes(query));
    }, [messages, messageQuery]);

    useEffect(() => {
        if (!messageSearchOpen || !messageQuery.trim() || !messageMatches.length) return;
        const frame = requestAnimationFrame(() => scrollToMessage(messageMatches[0].id));
        return () => cancelAnimationFrame(frame);
    }, [messageQuery, messageSearchOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    const goToMessageMatch = (index) => {
        if (!messageMatches.length) return;
        const normalized = (index + messageMatches.length) % messageMatches.length;
        setMessageMatchIndex(normalized);
        scrollToMessage(messageMatches[normalized].id);
    };

    const openViewer = (id) => {
        const idx = imageMessages.findIndex((i) => i.id === id);
        if (idx >= 0) setViewerIndex(idx);
    };
    const goProfile = (username) => { if (username) nav(`/app/u/${username}`); };
    const scrollToMessage = (id) => {
        const el = document.getElementById(`msg-${id}`);
        if (!el) return;
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'center' });
        setHighlightId(id);
        setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 1800);
    };

    const reloadChats = () => {
        if (!token) return;
        api('/chats', { token }).then(setChats).catch(() => {});
    };

    useEffect(() => { reloadChats(); }, [token, chatId]); // eslint-disable-line

    useEffect(() => {
        if (!chatId || !token) return;
        setFirstUnreadId(null);
        needsInitialScroll.current = true;
        nearBottomRef.current = true;
        setShowJumpToLatest(false);
        setUnseenCount(0);
        api(`/chats/${chatId}/messages${linkedMessageId ? `?focus=${encodeURIComponent(linkedMessageId)}` : ''}`, { token }).then((r) => {
            if (Array.isArray(r)) {
                setMessages(r); setPinned(null); setMyRole('member');
            } else {
                setMessages(r.messages || []);
                setPinned(r.pinned || null);
                setMyRole(r.myRole || 'member');
                setFirstUnreadId(r.firstUnreadId || null);
            }
        });
        socket?.emit('chat:join', chatId);
        notifications.markChatRead?.(chatId);
    }, [chatId, token, socket]); // eslint-disable-line

    useEffect(() => {
        if (!socket) return;
        const onNew = (m) => {
            if (m.chatId === chatId) {
                if (!nearBottomRef.current && m.senderId !== user.id && m.sender?.id !== user.id) setUnseenCount((n) => n + 1);
                setMessages((prev) => prev.some((item) => item.id === m.id) ? prev : [...prev, m]);
            }
            reloadChats();
        };
        const onEdited = (m) => setMessages((p) => p.map((x) => (x.id === m.id ? m : x)));
        const onDeleted = ({ messageId }) => {
            setMessages((p) => p.map((x) => x.id === messageId
                ? { ...x, deletedAt: new Date().toISOString(), content: '' } : x));
            setPinned((cur) => (cur?.id === messageId ? null : cur));
        };
        const onReaction = ({ messageId, emoji, userId, action }) => {
            setMessages((prev) => prev.map((m) => {
                if (m.id !== messageId) return m;
                const reactions = [...(m.reactions || [])];
                if (action === 'added') reactions.push({ messageId, emoji, userId });
                else {
                    const i = reactions.findIndex((r) => r.emoji === emoji && r.userId === userId);
                    if (i >= 0) reactions.splice(i, 1);
                }
                return { ...m, reactions };
            }));
        };
        const onTyping = ({ chatId: cid, userId: uid, isTyping }) => {
            if (uid === user.id) return;

            // ─── Состояние для открытого чата ───
            if (cid === chatId) {
                setTypingUsers((prev) =>
                    isTyping ? [...new Set([...prev, uid])] : prev.filter((x) => x !== uid)
                );
            }

            // ─── Состояние для списка чатов ───
            const key = `${cid}:${uid}`;
            const timers = typingClearTimers.current;

            if (isTyping) {
                setTypingByChat((prev) => {
                    const cur = new Set(prev[cid] || []);
                    cur.add(uid);
                    return { ...prev, [cid]: cur };
                });
                clearTimeout(timers.get(key));
                const t = setTimeout(() => {
                    setTypingByChat((prev) => {
                        const cur = new Set(prev[cid] || []);
                        cur.delete(uid);
                        const next = { ...prev };
                        if (cur.size === 0) delete next[cid];
                        else next[cid] = cur;
                        return next;
                    });
                    timers.delete(key);
                }, TYPING_TTL_MS);
                timers.set(key, t);
            } else {
                setTypingByChat((prev) => {
                    const cur = new Set(prev[cid] || []);
                    cur.delete(uid);
                    const next = { ...prev };
                    if (cur.size === 0) delete next[cid];
                    else next[cid] = cur;
                    return next;
                });
                clearTimeout(timers.get(key));
                timers.delete(key);
            }
        };
        const onPinned = ({ chatId: cid, message }) => { if (cid === chatId) setPinned(message); };
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
    }, [socket, chatId, token, user.id]); // eslint-disable-line

    // Очистка всех таймеров typing при размонтировании
    useEffect(() => {
        const timers = typingClearTimers.current;
        return () => {
            for (const t of timers.values()) clearTimeout(t);
            timers.clear();
        };
    }, []);

    // Late-loading media changes message heights after the initial scroll.
    // Follow those changes only while entering a read chat; never steal
    // scrolling from someone browsing the history.
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || !chatId || !messages.length || firstUnreadId || linkedMessageId || mediaFollowChatRef.current === chatId) return;
        mediaFollowChatRef.current = chatId;
        let userScrolled = false;
        let raf = 0;
        const followBottom = () => {
            if (userScrolled) return;
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => { if (!userScrolled) el.scrollTop = el.scrollHeight; });
        };
        const stopFollowing = () => { userScrolled = true; };
        const observer = new ResizeObserver(followBottom);
        const expiry = window.setTimeout(stopFollowing, 12000);
        Array.from(el.children).forEach((node) => observer.observe(node));
        const onMediaLoad = () => followBottom();
        el.addEventListener('load', onMediaLoad, true);
        el.addEventListener('loadedmetadata', onMediaLoad, true);
        el.addEventListener('wheel', stopFollowing, { passive: true });
        el.addEventListener('touchstart', stopFollowing, { passive: true });
        followBottom();
        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(expiry);
            observer.disconnect();
            el.removeEventListener('load', onMediaLoad, true);
            el.removeEventListener('loadedmetadata', onMediaLoad, true);
            el.removeEventListener('wheel', stopFollowing);
            el.removeEventListener('touchstart', stopFollowing);
        };
    }, [chatId, messages.length, firstUnreadId, linkedMessageId]);

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
                        setTimeout(() => setHighlightId((cur) => (cur === firstUnreadId ? null : cur)), 1800);
                    } else el.scrollTop = el.scrollHeight;
                } else el.scrollTop = el.scrollHeight;
            });
            needsInitialScroll.current = false;
            return;
        }
        // Do not yank the reader away from older messages when a new message arrives.
        if (messages.length > 0 && nearBottomRef.current && !linkedMessageId) {
            const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
            el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion ? 'instant' : 'smooth' });
        }
    }, [messages.length, firstUnreadId, linkedMessageId]);

    useEffect(() => {
        if (!linkedMessageId || !messages.some(m => m.id === linkedMessageId)) return;
        const frame = requestAnimationFrame(() => scrollToMessage(linkedMessageId));
        return () => cancelAnimationFrame(frame);
    }, [linkedMessageId, messages, chatId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        setShowMembers(false); setContextMenu(null); setMentionQuery(null);
        setChatMenu(null); setHeaderMenuOpen(false); setPanel(null);
        setAttachMenu(false); setSearchOpen(false); setSearch('');
        setReportTarget(null);
        setTypingUsers([]);
        setMessageSearchOpen(false); setMessageQuery(''); setMessageMatchIndex(0);
        setShowJumpToLatest(false); setUnseenCount(0);
    }, [chatId]);

    /* Pull-to-refresh на списке чатов */
    const { pull: chatPull, refreshing: chatRefreshing, threshold: chatThreshold } =
        usePullToRefresh({
            ref: chatListScrollRef,
            onRefresh: async () => {
                await new Promise((r) => {
                    api('/chats', { token })
                        .then(setChats)
                        .catch(() => {})
                        .finally(r);
                });
            },
            disabled: !!chatId,
        });

    const send = () => {
        if (!text.trim() || !chatId) return;
        if (editing) {
            socket.emit('message:edit', { messageId: editing.id, content: text });
            setEditing(null);
        } else {
            socket.emit('message:send', { chatId, content: text, type: 'text', replyToId: replyTo?.id });
        }
        setText(''); setReplyTo(null); setPanel(null); setMentionQuery(null);
    };

    const sendSticker = (id) => {
        socket.emit('message:send', { chatId, content: id, type: 'sticker', replyToId: replyTo?.id });
        setReplyTo(null); setPanel(null);
    };

    const sendFile = async (file, type) => {
        if (!file || !chatId) return;
        setUploading(true);
        try {
            const res = await uploadFile(file, token);
            socket.emit('message:send', { chatId, content: res.url, type, replyToId: replyTo?.id });
            setReplyTo(null);
        } catch (e) { alert(e.message); }
        finally { setUploading(false); }
    };

    const sendImage = (f) => sendFile(f, 'image');
    const sendVideo = (f) => sendFile(f, 'video');
    const sendDoc = (f) => sendFile(f, 'file');

    const sendPendingFiles = async () => {
        if (!pendingFiles.length || uploading || !chatId || !socket) return;
        setUploading(true);
        setAttachmentProgress(0);
        setAttachmentIndex(0);
        let completed = 0;
        try {
            const total = pendingFiles.length;
            for (const file of pendingFiles) {
                const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
                const previous = attachmentRetriesRef.current.get(file);
                const requestId = previous?.requestId || crypto.randomUUID();
                const result = previous?.result || await uploadFileWithProgress(file, token, (percent) => {
                    setAttachmentProgress(Math.round(((completed + percent / 100) / total) * 100));
                });
                attachmentRetriesRef.current.set(file, { requestId, result });
                await new Promise((resolve, reject) => {
                    socket.timeout(15000).emit('message:send', {
                        chatId, content: result.url, type, clientMessageId: requestId,
                        caption: (attachmentCaptions[completed] || '').trim() || undefined,
                        replyToId: completed === 0 ? replyTo?.id : undefined,
                    }, (err, response) => {
                        if (err || response?.error) reject(new Error(response?.error || 'Сервер не подтвердил сообщение'));
                        else resolve();
                    });
                });
                attachmentRetriesRef.current.delete(file);
                completed++;
                setAttachmentIndex(completed);
                setAttachmentProgress(Math.round(completed / total * 100));
            }
            setPendingFiles([]);
            setAttachmentCaptions({});
            setReplyTo(null);
        } catch (error) {
            setPendingFiles((files) => files.slice(completed));
            setAttachmentCaptions((captions) => Object.fromEntries(Object.entries(captions).filter(([i]) => Number(i) >= completed).map(([i, value]) => [Number(i) - completed, value])));
            setAttachmentProgress(0);
            alert('Не все файлы отправлены: ' + error.message);
        } finally { setUploading(false); }
    };

    const startRecording = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            alert('Ваш браузер не поддерживает запись звука'); return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true,
                    channelCount: 1, sampleRate: 48000, sampleSize: 16 },
            });
            const mimeType = pickAudioMime();
            const opts = { audioBitsPerSecond: 128000 };
            if (mimeType) opts.mimeType = mimeType;
            let mr;
            try { mr = new MediaRecorder(stream, opts); } catch { mr = new MediaRecorder(stream); }

            mediaRecorderRef.current = mr;
            recChunksRef.current = [];
            recMimeRef.current = mr.mimeType || mimeType || 'audio/webm';
            mr.ondataavailable = (e) => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
            mr.onstop = async () => {
                stream.getTracks().forEach((t) => t.stop());
                const blob = new Blob(recChunksRef.current, { type: recMimeRef.current });
                if (blob.size < 1000) return;
                const ext = extFromMime(recMimeRef.current);
                const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: recMimeRef.current });
                await sendFile(file, 'voice');
            };
            mr.start(1000);
            setRecording(true); setRecordingSec(0);
            recTimerRef.current = setInterval(() => setRecordingSec((s) => s + 1), 1000);
        } catch (e) { alert('Не удалось получить доступ к микрофону: ' + e.message); }
    };

    const stopRecording = (cancel = false) => {
        const mr = mediaRecorderRef.current;
        if (!mr) return;
        clearInterval(recTimerRef.current);
        setRecording(false);
        if (cancel) { mr.ondataavailable = null; mr.onstop = null; }
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
        typingTimeout.current = setTimeout(() => socket.emit('typing', { chatId, isTyping: false }), 1200);
    };

    const applyMention = (member) => {
        if (!mentionQuery) return;
        const before = text.slice(0, mentionQuery.start);
        const after = text.slice(mentionQuery.start + mentionQuery.query.length + 1);
        setText(`${before}@${member.username} ${after}`);
        setMentionQuery(null);
        textareaRef.current?.focus();
    };

    const toggleReaction = (id, emoji) => socket.emit('reaction:toggle', { messageId: id, emoji });
    const toggleSearch = () => {
        if (searchOpen) { setSearch(''); setSearchOpen(false); }
        else setSearchOpen(true);
    };

    const doForward = (target) => {
        socket.emit('message:send', {
            chatId: target, content: forwarding.content, type: forwarding.type,
            forwardedFrom: { userId: forwarding.sender.id, fullName: forwarding.sender.fullName },
        });
        setForwarding(null);
        nav(`/app/chats/${target}`);
    };

    const pinMessage = async (m) => {
        try {
            const r = await api(`/chats/${chatId}/pin`, { method: 'POST', token, body: { messageId: m.id } });
            setPinned(r.message);
        } catch (e) { alert(e.message); }
    };
    const unpinMessage = async () => {
        try {
            await api(`/chats/${chatId}/pin`, { method: 'DELETE', token });
            setPinned(null);
        } catch (e) { alert(e.message); }
    };

    const deleteChat = async (chat) => {
        if (!chat) return;
        const isGroup = chat.type === 'GROUP';
        const isAdmin = chat.myRole === 'admin' || chat.members?.find((m) => m.id === user.id)?.role === 'admin';
        let confirmText;
        if (isGroup && isAdmin) confirmText = `Удалить группу «${chat.title}» для всех?`;
        else if (isGroup) confirmText = `Покинуть группу «${chat.title}»?`;
        else confirmText = `Удалить чат? Он исчезнет только у вас.`;
        if (!confirm(confirmText)) return;
        try {
            await api(`/chats/${chat.id}`, { method: 'DELETE', token });
            setChats((prev) => prev.filter((c) => c.id !== chat.id));
            if (chatId === chat.id) nav('/app/chats');
        } catch (e) { alert(e.message); }
    };

    const contextActions = (m) => {
        const isOwn = m.sender.id === user.id;
        const canPin = activeChat?.type === 'GROUP'
            ? activeChat.members.find((x) => x.id === user.id)?.role === 'admin' ||
            !activeChat.members.find((x) => x.id === user.id)?.role
            : true;
        const actions = [
            { id: 'react', label: '❤️ Реакция' },
            { id: 'reply', label: '↩ Ответить' },
            { id: 'copy', label: '📋 Копировать', only: m.type === 'text' },
            { id: 'forward', label: '↪ Переслать' },
            { id: 'pin', label: '📌 Закрепить', only: !m.deletedAt && canPin },
            { id: 'report', label: '🚩 Пожаловаться', only: !isOwn && !m.deletedAt, danger: true },
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
                case 'report': setReportTarget({ type: 'message', id: m.id }); break;
                case 'edit': setEditing(m); setText(m.content); break;
                case 'delete':
                    if (confirm('Удалить сообщение?'))
                        socket.emit('message:delete', { messageId: m.id });
                    break;
            }
        };
        return { actions, handler };
    };

    const unreadChatCount = chats.filter((c) => Number(c.unread) > 0).length;
    const filteredChats = chats.filter((c) => {
        if (chatFilter === 'unread' && !(Number(c.unread) > 0)) return false;
        const name = c.type === 'GROUP' ? c.title : c.members.find((m) => m.id !== user.id)?.fullName;
        const query = search.trim().toLocaleLowerCase('ru');
        return !query || [name, c.lastMessage?.content]
            .some((value) => String(value || '').toLocaleLowerCase('ru').includes(query));
    });

    const chatMembers = activeChat?.members || [];
    const isActiveGroup = activeChat?.type === 'GROUP';
    const isActiveGroupAdmin = isActiveGroup && myRole === 'admin';
    const deleteLabel = isActiveGroup
        ? isActiveGroupAdmin ? '🗑️ Удалить группу' : '🚪 Покинуть группу'
        : '🗑️ Удалить чат';

    /* Кто печатает в чате c? Возвращает имена через запятую или null. */
    const whoIsTyping = (c) => {
        const ids = typingByChat[c.id];
        if (!ids || ids.size === 0) return null;
        // В личных — «печатает…». В группах — «Вася печатает…»
        if (c.type !== 'GROUP') return 'печатает…';
        const member = c.members.find((m) => ids.has(m.id));
        if (!member) return 'печатает…';
        return `${member.fullName.split(' ')[0]} печатает…`;
    };

    return (
        <div
            className={isChatRoom ? 'fixed inset-0 md:left-64 z-40 flex min-w-0 max-w-full overflow-hidden overscroll-none bg-ink-900' : 'flex'}
            style={isChatRoom ? {
                paddingTop: 'env(safe-area-inset-top, 0px)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            } : undefined}
            onClick={() => {
                if (contextMenu) setContextMenu(null);
                if (chatMenu) setChatMenu(null);
                if (headerMenuOpen) setHeaderMenuOpen(false);
                if (attachMenu) setAttachMenu(false);
            }}
        >
            {/* Список чатов */}
            <aside className={`${chatId ? 'hidden md:flex' : 'flex'} md:w-80 w-full flex-col border-r border-white/5 bg-ink-800/50 min-h-0`}>
                <div className="p-4 border-b border-white/5 shrink-0">
                    <div className="flex items-center gap-1">
                        <h2 className="text-xl font-bold">Чаты</h2>
                        <div className="ml-auto"><NewChatButton onCreated={(id) => nav(`/app/chats/${id}`)} /></div>
                    </div>
                    <div className="flex items-center gap-2 mt-3" role="group" aria-label="Фильтр чатов">
                        <button type="button" onClick={() => setChatFilter('all')} aria-pressed={chatFilter === 'all'}
                            className={`rounded-full px-3 py-1.5 text-sm transition ${chatFilter === 'all' ? 'bg-violet-500/25 text-violet-100 ring-1 ring-violet-400/40' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>
                            Все <span className="opacity-60">{chats.length}</span>
                        </button>
                        <button type="button" onClick={() => setChatFilter('unread')} aria-pressed={chatFilter === 'unread'}
                            className={`rounded-full px-3 py-1.5 text-sm transition ${chatFilter === 'unread' ? 'bg-violet-500/25 text-violet-100 ring-1 ring-violet-400/40' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>
                            Непрочитанные {unreadChatCount > 0 && <span className="ml-1 font-semibold">{unreadChatCount}</span>}
                        </button>
                    </div>
                </div>

                <div
                    ref={chatListScrollRef}
                    className="flex-1 overflow-y-auto no-scrollbar min-h-0"
                >
                    <PullToRefreshIndicator
                        pull={chatPull}
                        refreshing={chatRefreshing}
                        threshold={chatThreshold}
                    />
                    {filteredChats.map((c) => {
                        const other = c.members.find((m) => m.id !== user.id);
                        const title = c.type === 'GROUP' ? c.title : other?.fullName;
                        const otherOnline = c.type !== 'GROUP' && other && onlineUsers.has(other.id);
                        const typingText = whoIsTyping(c);
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
                                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition ${c.id === chatId ? 'bg-white/5' : ''}`}
                                >
                                    {c.type === 'GROUP'
                                        ? <GroupAvatar members={c.members} onlineSet={onlineUsers} />
                                        : <Avatar user={other} size={46} online={otherOnline} />}
                                    <div className="flex-1 min-w-0 text-left">
                                        <div className="font-semibold truncate">{title}</div>
                                        <div className={`text-xs truncate ${typingText ? 'text-violet-soft italic' : 'text-white/40'}`}>
                                            {typingText ? (
                                                <span className="inline-flex items-center gap-1">
                                                    {typingText}
                                                    <span className="mrr-typing-dots">
                                                        <span>.</span><span>.</span><span>.</span>
                                                    </span>
                                                </span>
                                            ) : c.lastMessage?.type === 'sticker' ? '🎨 Стикер'
                                                : c.lastMessage?.type === 'image' ? '🖼️ Изображение'
                                                    : c.lastMessage?.type === 'video' ? '🎥 Видео'
                                                        : c.lastMessage?.type === 'voice' ? '🎤 Голосовое'
                                                            : c.lastMessage?.type === 'file' ? '📎 Файл'
                                                                : c.lastMessage?.content || 'Нет сообщений'}
                                        </div>
                                    </div>
                                    {Number(c.unread) > 0 && <span className="shrink-0 min-w-6 h-6 px-1.5 rounded-full bg-pink text-white text-xs font-bold inline-flex items-center justify-center" aria-label={`Непрочитанных сообщений: ${c.unread}`}>{Number(c.unread) > 99 ? '99+' : c.unread}</span>}
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const r = e.currentTarget.getBoundingClientRect();
                                        setChatMenu({ x: r.right, y: r.bottom, chat: c });
                                    }}
                                    className="hidden md:grid place-items-center absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-ink-700/90 hover:bg-ink-600 text-white/60 opacity-0 group-hover:opacity-100 transition"
                                >⋯</button>
                            </div>
                        );
                    })}
                    {filteredChats.length === 0 && (
                        <div className="p-6 text-center text-white/50 text-sm">
                            <p>{search.trim() ? 'По вашему запросу ничего не найдено' : chatFilter === 'unread' ? 'Все сообщения прочитаны ✨' : 'Пока нет переписок'}</p>
                            {(search.trim() || chatFilter === 'unread') && (
                                <button type="button" className="mt-3 text-violet-200 underline underline-offset-4" onClick={() => { setSearch(''); setChatFilter('all'); }}>Показать все чаты</button>
                            )}
                        </div>
                    )}
                </div>
            </aside>

            {/* Активный чат */}
            <section className={`${chatId ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0 relative min-h-0`}>
                {!chatId ? (
                    <div className="flex-1 grid place-items-center text-white/30">
                        <div className="text-center">
                            <div className="text-6xl mb-3">💬</div>
                            <p>Выбери чат слева</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <header className="relative z-30 px-3 py-2.5 md:px-4 border-b border-white/10 bg-ink-800/80 backdrop-blur flex items-center gap-2 shrink-0">
                            <button
                                className="md:hidden btn-ghost !p-2 min-w-10 min-h-10 rounded-xl"
                                onClick={() => nav('/app/chats')}
                                aria-label="Назад к списку чатов"
                            >←</button>
                            <button
                                onClick={() => {
                                    if (activeChat?.type === 'GROUP') setShowMembers(true);
                                    else {
                                        const other = activeChat?.members.find((m) => m.id !== user.id);
                                        if (other?.username) nav(`/app/u/${other.username}`);
                                    }
                                }}
                                className="flex items-center gap-3 min-w-0 flex-1 text-left hover:opacity-90 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
                            >
                                {activeChat?.type === 'GROUP' ? (
                                    <GroupAvatar members={activeChat.members} onlineSet={onlineUsers} />
                                ) : (
                                    <Avatar
                                        user={activeChat?.members.find((m) => m.id !== user.id)}
                                        size={40}
                                        online={onlineUsers.has(activeChat?.members.find((m) => m.id !== user.id)?.id)}
                                    />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold truncate">{chatTitle}</div>
                                    <div className="text-xs text-white/40">
                                        {typingUsers.length > 0 ? 'печатает…'
                                            : activeChat?.type === 'GROUP'
                                                ? `${activeChat.members.length} участников · ${activeChat.members.filter((m) => onlineUsers.has(m.id)).length} в сети`
                                                : onlineUsers.has(activeChat?.members.find((m) => m.id !== user.id)?.id)
                                                    ? 'в сети' : 'не в сети'}
                                    </div>
                                </div>
                            </button>
                            <div className="relative">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setHeaderMenuOpen((v) => !v); }}
                                    className={`btn-ghost !p-2 min-w-10 min-h-10 rounded-xl ${headerMenuOpen ? 'bg-white/10' : ''}`}
                                aria-label="Меню чата" aria-expanded={headerMenuOpen}>⋯</button>
                                {headerMenuOpen && (
                                    <div
                                        className="absolute right-0 top-full mt-2 z-50 card p-1 w-56 animate-pop"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <button type="button"
                                            onClick={() => { setHeaderMenuOpen(false); setShowGallery(true); }}
                                            className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5 flex items-center gap-2"
                                        >🖼️ Медиа и файлы</button>
                                        {activeChat?.type === 'GROUP' && (
                                            <button type="button"
                                                onClick={() => { setHeaderMenuOpen(false); setShowMembers(true); }}
                                                className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5 flex items-center gap-2"
                                            >👥 Участники чата</button>
                                        )}
                                        {pinned && (
                                            <button type="button"
                                                onClick={() => { setHeaderMenuOpen(false); scrollToMessage(pinned.id); }}
                                                className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5 flex items-center gap-2"
                                            >📌 Закреплённое сообщение</button>
                                        )}
                                        <div className="my-1 border-t border-white/10" />
                                        <button
                                            onClick={() => { setHeaderMenuOpen(false); deleteChat(activeChat); }}
                                            className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5 text-pink"
                                        >{deleteLabel}</button>
                                    </div>
                                )}
                            </div>
                        </header>

                        <PinnedBar
                            message={pinned}
                            onUnpin={unpinMessage}
                            onJump={() => pinned && scrollToMessage(pinned.id)}
                        />

                        <div className="relative z-0 flex-1 min-h-0">
                        <div ref={scrollRef} onScroll={(event) => {
                            const el = event.currentTarget;
                            const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
                            nearBottomRef.current = nearBottom;
                            setShowJumpToLatest(!nearBottom);
                            if (nearBottom) setUnseenCount(0);
                        }} className="h-full w-full min-w-0 max-w-full overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 md:px-6 py-4 space-y-2">
                            {messages.map((m, index) => (
                                <div key={m.id} className="space-y-2">
                                    {(index === 0 || messageDayKey(messages[index - 1].createdAt) !== messageDayKey(m.createdAt)) && (
                                        <div className="flex items-center justify-center py-3" role="separator" aria-label={messageDayLabel(m.createdAt)}>
                                            <span className="rounded-full border px-3 py-1 text-xs font-semibold shadow-sm" style={{ backgroundColor: "var(--bg-elev-2)", color: "var(--text-secondary)", borderColor: "var(--border-strong)" }}>
                                                {messageDayLabel(m.createdAt)}
                                            </span>
                                        </div>
                                    )}
                                    {firstUnreadId === m.id && (
                                        <div role="separator" aria-label="Непрочитанные сообщения"
                                            className="flex items-center gap-3 py-3" style={{ color: 'var(--text-secondary)' }}>
                                            <span className="h-px flex-1" style={{ backgroundColor: 'var(--border-strong)' }} />
                                            <span className="rounded-full px-3 py-1 text-xs font-semibold"
                                                style={{ backgroundColor: 'var(--bg-elev-2)', border: '1px solid var(--border-strong)' }}>
                                                Непрочитанные сообщения
                                            </span>
                                            <span className="h-px flex-1" style={{ backgroundColor: 'var(--border-strong)' }} />
                                        </div>
                                    )}
                                    <MessageBubble
                                    m={m}
                                    isOwn={m.sender.id === user.id}
                                    highlight={highlightId === m.id}
                                    onlineSet={onlineUsers}
                                    onReact={(emoji) => toggleReaction(m.id, emoji)}
                                    onSwipeReply={(message) => { setReplyTo(message); setEditing(null); textareaRef.current?.focus(); }}
                                    onOpenImage={() => openViewer(m.id)}
                                    onOpenProfile={() => goProfile(m.sender.username)}
                                    onScrollToReply={(id) => scrollToMessage(id)}
                                    onLongPress={(e) => {
                                        const { clientX, clientY } = e.touches?.[0] || e;
                                        setContextMenu({ x: clientX, y: clientY, message: m });
                                    }}
                                />
                                </div>
                            ))}
                        </div>
                        {showJumpToLatest && (
                            <button type="button"
                                aria-label={unseenCount ? `К последним сообщениям, новых: ${unseenCount}` : 'К последним сообщениям'}
                                title="К последним сообщениям"
                                onClick={() => {
                                    const el = scrollRef.current;
                                    if (!el) return;
                                    nearBottomRef.current = true;
                                    setShowJumpToLatest(false);
                                    setUnseenCount(0);
                                    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
                                    el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'instant' : 'smooth' });
                                }}
                                className="absolute bottom-4 right-4 md:right-6 z-20 flex items-center gap-2 rounded-full border px-3 py-2.5 shadow-lg backdrop-blur-md transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet"
                                style={{ backgroundColor: 'var(--bg-elev-2)', color: 'var(--text-primary)', borderColor: 'var(--border-strong)' }}>
                                {unseenCount > 0 && <span className="rounded-full bg-violet px-2 py-0.5 text-xs font-bold text-white">{unseenCount > 99 ? '99+' : unseenCount}</span>}
                                <span aria-hidden="true">↓</span>
                            </button>
                        )}
                        </div>

                        {/* Панель ввода */}
                        <div className="border-t border-white/10 p-2.5 md:p-3 space-y-2 shrink-0 bg-ink-900/95 backdrop-blur relative">
                            {replyTo && (
                                <div className="flex items-center gap-2 bg-ink-700/60 rounded-2xl px-3 py-2 text-sm">
                                    <div className="w-1 h-8 rounded bg-violet" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-violet-soft text-xs font-bold">Ответ {replyTo.sender.fullName}</div>
                                        <div className="text-white/60 truncate">
                                            {replyTo.type === 'image' ? '🖼️ Изображение'
                                                : replyTo.type === 'video' ? '🎥 Видео'
                                                    : replyTo.type === 'voice' ? '🎤 Голосовое'
                                                        : replyTo.type === 'file' ? '📎 Файл'
                                                            : replyTo.content}
                                        </div>
                                    </div>
                                    <button onClick={() => setReplyTo(null)} className="text-white/40">✕</button>
                                </div>
                            )}

                            {editing && (
                                <div className="flex items-center gap-2 bg-cyan/10 rounded-2xl px-3 py-2 text-sm text-cyan-soft">
                                    ✏️ Редактирование
                                    <button onClick={() => { setEditing(null); setText(''); }} className="ml-auto">✕</button>
                                </div>
                            )}

                            {pendingFiles.length > 0 && (
                                <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-elev-2)' }}>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-semibold">Вложения: {pendingFiles.length} из 20</span>
                                        <button type="button" disabled={uploading} onClick={() => { setPendingFiles([]); setAttachmentCaptions({}); }} aria-label="Отменить вложения">✕</button>
                                    </div>
                                    <div className="flex gap-2 overflow-x-auto pb-1">
                                        {pendingFiles.map((file, index) => (
                                            <div key={index + '-' + file.name} className="relative shrink-0 w-44 rounded-lg border p-2 text-xs" style={{ borderColor: 'var(--border-strong)' }}>
                                                <AttachmentPreview file={file} />
                                                <div className="truncate" title={file.name}>{file.name}</div>
                                                <div className="opacity-60">{(file.size / 1024 / 1024).toFixed(1)} МБ</div>
                                                <textarea rows={2} value={attachmentCaptions[index] || ''}
                                                    onChange={(e) => setAttachmentCaptions((captions) => ({ ...captions, [index]: e.target.value }))}
                                                    disabled={uploading} maxLength={2000}
                                                    placeholder="Подпись…" aria-label={`Подпись для ${file.name}`}
                                                    className="mt-2 w-full resize-none rounded-md border bg-transparent px-1.5 py-1 text-xs"
                                                    style={{ borderColor: 'var(--border-strong)' }} />
                                                <button type="button" disabled={uploading} aria-label={`Убрать ${file.name}`}
                                                    onClick={() => { setPendingFiles((files) => files.filter((_, i) => i !== index)); setAttachmentCaptions((captions) => Object.fromEntries(Object.entries(captions).filter(([i]) => Number(i) !== index).map(([i, value]) => [Number(i) > index ? Number(i) - 1 : Number(i), value]))); }}
                                                    className="absolute -top-1 -right-1 rounded-full px-1.5 bg-ink-700 text-white">✕</button>
                                            </div>
                                        ))}
                                    </div>
                                    {uploading && <div className="space-y-1" role="status" aria-live="polite">
                                        <div className="flex justify-between text-xs"><span>Загрузка: {attachmentIndex + 1} из {pendingFiles.length}</span><span>{attachmentProgress}%</span></div>
                                        <progress value={attachmentProgress} max="100" aria-label="Прогресс отправки вложений" className="w-full h-2 accent-violet" />
                                    </div>}
                                    <button type="button" disabled={uploading} onClick={sendPendingFiles}
                                        className="btn-primary w-full !py-2 text-sm">{uploading ? 'Отправляем…' : `Отправить ${pendingFiles.length} файл(ов)`}</button>
                                </div>
                            )}

                            {pendingFiles.length > 0 ? null : recording ? (
                                <div className="flex items-center gap-3 bg-pink/10 border border-pink/30 rounded-2xl px-3 py-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-pink animate-pulse" />
                                    <div className="flex-1">
                                        <div className="text-sm text-pink">Запись голосового…</div>
                                        <div className="text-xs text-white/50">{recordingSec} сек</div>
                                    </div>
                                    <button onClick={() => stopRecording(true)} className="btn-ghost !py-1.5 !px-3 text-xs text-white/70">Отмена</button>
                                    <button onClick={() => stopRecording(false)} className="btn-primary !py-1.5 !px-3 text-xs">Отправить ➤</button>
                                </div>
                            ) : (
                                <div className="flex items-end gap-1.5 md:gap-2">
                                    <div className="relative shrink-0">
                                        <button
                                            className="btn-ghost !p-2.5 md:!p-3 text-lg md:text-xl"
                                            onClick={(e) => { e.stopPropagation(); setAttachMenu((v) => !v); setPanel(null); }}
                                            disabled={uploading}
                                            title="Прикрепить"
                                        >{uploading ? '⏳' : '＋'}</button>
                                        {attachMenu && (
                                            <div className="absolute bottom-full left-0 mb-2 z-30 card p-1 w-56 animate-pop" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => { setAttachMenu(false); fileRef.current?.click(); }}
                                                    className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5 flex items-center gap-2"
                                                ><span className="text-lg">📷</span><span>Фото / видео</span></button>
                                                <button
                                                    onClick={() => { setAttachMenu(false); mediaFileRef.current?.click(); }}
                                                    className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5 flex items-center gap-2"
                                                ><span className="text-lg">📄</span><span>Документ</span></button>
                                            </div>
                                        )}
                                    </div>

                                    <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden
                                           onChange={(e) => {
                                               const files = Array.from(e.target.files || []);
                                               e.target.value = '';
                                               if (files.length) setPendingFiles((current) => [...current, ...files].slice(0, 20));
                                           }}
                                    />
                                    <input ref={mediaFileRef} type="file" multiple hidden
                                           onChange={(e) => {
                                               const files = Array.from(e.target.files || []);
                                               e.target.value = '';
                                               if (files.length) setPendingFiles((current) => [...current, ...files].slice(0, 20));
                                           }}
                                    />

                                    <button
                                        className={`btn-ghost !p-2.5 md:!p-3 text-lg md:text-xl shrink-0 ${panel ? 'bg-white/10' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); setPanel((p) => (p ? null : 'emoji')); setAttachMenu(false); }}
                                        title="Эмодзи и стикеры" aria-label="Выбрать эмодзи или стикер" aria-expanded={Boolean(panel)}
                                    >😊</button>

                                    <textarea
                                        ref={textareaRef}
                                        rows={1}
                                        value={text}
                                        onChange={handleChange}
                                        onKeyDown={(e) => {
                                            if (mentionQuery) return;
                                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                                        }}
                                        placeholder="Написать сообщение…"
                                        className="input flex-1 min-w-0 resize-none max-h-40 !py-2.5 md:!py-3 text-base rounded-2xl" aria-label="Текст сообщения"
                                        autoComplete="off"
                                    />

                                    {text.trim() ? (
                                        <button onClick={send} className="btn-primary !p-2.5 md:!p-3 text-lg md:text-xl shrink-0 min-w-11 min-h-11 rounded-2xl" aria-label="Отправить сообщение">➤</button>
                                    ) : (
                                        <button onClick={startRecording} className="btn-primary !p-2.5 md:!p-3 text-lg md:text-xl shrink-0 min-w-11 min-h-11 rounded-2xl" title="Голосовое сообщение" aria-label="Записать голосовое сообщение">🎤</button>
                                    )}
                                </div>
                            )}

                            {pendingFiles.length === 0 && panel && (
                                <div className="card p-3 animate-pop" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex gap-2 mb-3">
                                        <button onClick={() => setPanel('emoji')} className={`chip ${panel === 'emoji' ? 'bg-violet text-white' : 'bg-white/5 text-white/60'}`}>😊 Эмодзи</button>
                                        <button onClick={() => setPanel('stickers')} className={`chip ${panel === 'stickers' ? 'bg-violet text-white' : 'bg-white/5 text-white/60'}`}>🎨 Стикеры</button>
                                    </div>
                                    {panel === 'emoji' && (
                                        <div className="grid grid-cols-6 gap-1">
                                            {QUICK_EMOJI.map((e) => (
                                                <button key={e} onClick={() => setText((t) => t + e)} className="text-2xl hover:scale-125 transition">{e}</button>
                                            ))}
                                        </div>
                                    )}
                                    {panel === 'stickers' && (
                                        <div className="grid grid-cols-4 md:grid-cols-6 gap-2 max-h-64 overflow-y-auto no-scrollbar">
                                            {STICKERS.map((s) => (
                                                <button key={s.id} onClick={() => sendSticker(s.id)} className="hover:scale-105 transition">
                                                    <Sticker id={s.id} size={80} className="w-full h-auto" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {pendingFiles.length === 0 && mentionQuery && chatMembers.length > 0 && (
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
                                <div className="absolute inset-0 bg-black/40 z-10" onClick={() => setShowMembers(false)} />
                                <div className="absolute top-14 right-2 md:right-3 w-72 max-h-[70%] card z-20 p-3 flex flex-col animate-pop">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="font-bold text-sm">Участники · {activeChat.members.length}</div>
                                        <button onClick={() => setShowMembers(false)} className="text-white/40 hover:text-white">✕</button>
                                    </div>
                                    <div className="overflow-y-auto space-y-1 pr-1">
                                        {activeChat.members.map((m) => (
                                            <button
                                                key={m.id}
                                                onClick={() => { setShowMembers(false); goProfile(m.username); }}
                                                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 text-left"
                                            >
                                                <Avatar user={m} size={36} online={onlineUsers.has(m.id)} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-semibold truncate">
                                                        {m.fullName}
                                                        {m.role === 'admin' && <span className="ml-2 text-[10px] text-violet-soft uppercase">админ</span>}
                                                    </div>
                                                    <div className="text-xs text-white/40 truncate">
                                                        @{m.username}
                                                        {onlineUsers.has(m.id) && <span className="text-lime ml-2">в сети</span>}
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

            {/* Контекстное меню сообщения */}
            {contextMenu && (() => {
                const { actions, handler } = contextActions(contextMenu.message);
                const selected = contextMenu.message;
                const rect = document.getElementById(`msg-${selected.id}`)?.getBoundingClientRect();
                const mobileWidth = Math.min(320, window.innerWidth - 24);
                const menuHeight = Math.min(350, actions.length * 43 + 16);
                const previewHeight = 72;
                const totalHeight = 54 + previewHeight + menuHeight + 18;
                const top = Math.max(12, Math.min((rect?.top ?? contextMenu.y) - 54, window.innerHeight - totalHeight - 12));
                const left = Math.max(12, Math.min(rect?.left ?? contextMenu.x - mobileWidth / 2, window.innerWidth - mobileWidth - 12));
                const previewText = selected.deletedAt ? 'Сообщение удалено'
                    : selected.type === 'image' ? '🖼️ Фотография'
                    : selected.type === 'video' ? '🎥 Видео'
                    : selected.type === 'voice' ? '🎤 Голосовое сообщение'
                    : selected.type === 'sticker' ? '🎨 Стикер'
                    : selected.type === 'file' ? '📎 Документ'
                    : selected.content || '';
                const quickReactions = ['❤️', '🤩', '👍', '👎', '🔥', '🥰', '👏'];
                const style = {
                    position: 'fixed',
                    left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 208)),
                    top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 16 - actions.length * 44)),
                    zIndex: 80,
                };
                return (
                    <>
                        <button type="button" className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-[3px] md:bg-transparent md:backdrop-blur-none cursor-default"
                            onClick={() => setContextMenu(null)} aria-label="Закрыть действия с сообщением" />
                        {/* Telegram-inspired contextual popover with a selected-message preview. */}
                        <div className="mrr-message-actions fixed z-[80] md:hidden flex flex-col gap-2"
                            style={{ left, top, width: mobileWidth, maxHeight: 'calc(100dvh - 24px)' }}
                            role="dialog" aria-modal="true" aria-label="Действия с сообщением">
                            {!selected.deletedAt && (
                                <div className="flex items-center justify-between gap-1 rounded-full px-2 py-1 shadow-xl border"
                                    style={{ backgroundColor: 'var(--bg-elev-1)', borderColor: 'var(--border-strong)' }}>
                                    {quickReactions.map((emoji) => (
                                        <button type="button" key={emoji} onClick={() => { toggleReaction(selected.id, emoji); setContextMenu(null); }}
                                            className="text-xl flex-1 min-w-0 h-10 rounded-full active:scale-110 transition-transform"
                                            aria-label={`Реакция ${emoji}`}>{emoji}</button>
                                    ))}
                                </div>
                            )}
                            <div className="rounded-2xl px-3 py-3 shadow-lg border max-h-[72px] overflow-hidden"
                                style={{ backgroundColor: selected.sender.id === user.id ? 'var(--bg-elev-3)' : 'var(--bg-elev-2)', color: 'var(--text-primary)', borderColor: 'var(--border-strong)' }}>
                                <div className="text-xs font-semibold opacity-60 mb-1">{selected.sender.fullName}</div>
                                <div className="text-sm line-clamp-2 break-words">{previewText}</div>
                            </div>
                            <div className="rounded-2xl border shadow-2xl p-1 overflow-y-auto min-h-0"
                                style={{ backgroundColor: 'var(--bg-elev-1)', color: 'var(--text-primary)', borderColor: 'var(--border-strong)', maxHeight: menuHeight }}>
                                {actions.filter((a) => a.id !== 'react').map((a) => (
                                    <button type="button" key={a.id} onClick={() => handler(a.id)}
                                        className="w-full min-h-10 text-left px-3 py-2 text-sm rounded-xl hover:bg-white/10 active:bg-white/15"
                                        style={a.danger ? { color: '#e94b78' } : undefined}>
                                        {a.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* На компьютере оставляем контекстное меню у курсора. */}
                        <div className="hidden md:block card p-1 w-48 animate-pop" style={style}>
                            {actions.map((a) => (
                                <button type="button" key={a.id} onClick={() => handler(a.id)}
                                    className={`w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5 ${a.danger ? 'text-pink' : ''}`}>
                                    {a.label}
                                </button>
                            ))}
                        </div>
                    </>
                );
            })()}

            {/* Контекстное меню чата */}
            {chatMenu && (() => {
                const c = chatMenu.chat;
                const isGroup = c.type === 'GROUP';
                const isAdmin = c.myRole === 'admin';
                const label = isGroup
                    ? isAdmin ? '🗑️ Удалить группу' : '🚪 Покинуть группу'
                    : '🗑️ Удалить чат';
                const style = {
                    position: 'fixed',
                    left: Math.min(chatMenu.x - 40, window.innerWidth - 220),
                    top: Math.min(chatMenu.y, window.innerHeight - 100),
                    zIndex: 80,
                };
                return (
                    <>
                        <div className="fixed inset-0 z-[70]" onClick={() => setChatMenu(null)} />
                        <div className="card p-1 w-52 animate-pop" style={style}>
                            <button
                                onClick={() => { setChatMenu(null); deleteChat(c); }}
                                className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5 text-pink"
                            >{label}</button>
                        </div>
                    </>
                );
            })()}

            {/* Модалка пересылки */}
            {forwarding && (
                <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={() => setForwarding(null)}>
                    <div className="card p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <div className="font-bold mb-3">Переслать в…</div>
                        <div className="max-h-80 overflow-y-auto">
                            {chats.filter((c) => c.id !== chatId).map((c) => {
                                const other = c.members.find((m) => m.id !== user.id);
                                return (
                                    <button
                                        key={c.id}
                                        onClick={() => doForward(c.id)}
                                        className="w-full flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl"
                                    >
                                        {c.type === 'GROUP'
                                            ? <GroupAvatar members={c.members} onlineSet={onlineUsers} />
                                            : <Avatar user={other} size={36} />}
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
                <MediaGalleryModal chatId={chatId} onClose={() => setShowGallery(false)} onJumpToMessage={scrollToMessage} />
            )}

            {reportTarget && (
                <ReportButton
                    targetType={reportTarget.type}
                    targetId={reportTarget.id}
                    externalOpen={true}
                    onExternalClose={() => setReportTarget(null)}
                />
            )}
        </div>
    );
}