import { presenceLabel } from '../lib/presence.js';
import RecordingWaveform from '../components/messenger/RecordingWaveform.jsx';
import VoicePlayer from '../components/VoicePlayer.jsx';
import AttachmentPreview from '../components/messenger/AttachmentPreview.jsx';
import AttachmentEditorV2 from '../components/messenger/AttachmentEditorV2.jsx';
import { uploadFileWithProgress } from '../api/client.js';
import { sendAttachmentBatch } from '../lib/sendAttachmentBatch.js';
import { useEffect, useMemo, useRef, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
import PhotoAlbum from '../components/messenger/PhotoAlbum.jsx';
import GroupAvatar from '../components/messenger/GroupAvatar.jsx';
import NewChatButton from '../components/messenger/NewChatButton.jsx';
import ReportButton from '../components/ReportButton.jsx';
import PullToRefreshIndicator from '../components/PullToRefreshIndicator.jsx';
import usePullToRefresh from '../hooks/usePullToRefresh.js';
import usePageMeta from '../hooks/usePageMeta.js';
import { useSettings } from '../store/settings.jsx';
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
    const { raw: messengerSettings } = useSettings();
    const canUseNewUI = messengerSettings.messenger_ui_access === 'all' || (user?.role === 'admin' || user?.role === 'ADMIN');
    const allowUIChoice = messengerSettings.messenger_ui_user_choice === 'true' && canUseNewUI;
    const preferredUI = canUseNewUI && messengerSettings.messenger_ui_default === 'new' ? 'new' : 'classic';
    const [uiOverride, setUIOverride] = useState(() => {
        try { return window.localStorage.getItem('mrr_messenger_ui') || ''; } catch { return ''; }
    });
    const messengerVersion = canUseNewUI && allowUIChoice && ['classic', 'new'].includes(uiOverride) ? uiOverride : preferredUI;
    const isMessengerV2 = messengerVersion === 'new';
    const changeMessengerUI = (version) => {
        setUIOverride(version);
        try { window.localStorage.setItem('mrr_messenger_ui', version); } catch { /* storage unavailable */ }
    };
    const socket = useSocket();
    const onlineUsers = useOnlineUsers();
    const nav = useNavigate();
    const notifications = useNotifications();

    const isChatRoom = !!chatId;

    const [chats, setChats] = useState([]);
    const [messages, setMessages] = useState([]);
    const [hasMoreServerHistory, setHasMoreServerHistory] = useState(false);
    const loadingOlderHistoryRef = useRef(false);
    const messagesFetchSeqRef = useRef(0);
    const socketDuringFetchRef = useRef([]);
    const messagesFetchPendingRef = useRef(false);
    const [chatReceipts, setChatReceipts] = useState([]);
    const [pinned, setPinned] = useState(null);
    const [myRole, setMyRole] = useState('member');
    const [firstUnreadId, setFirstUnreadId] = useState(null);
    const [text, setText] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const [forwarding, setForwarding] = useState(null);
    const [editing, setEditing] = useState(null);
    // A draft belongs to the signed-in user and to one chat, never to another.
    const draftStorageKey = chatId && user?.id ? `mrr:chat-draft:v2:${user.id}:${chatId}` : null;
    const [draftReadyFor, setDraftReadyFor] = useState(null);
    useEffect(() => {
        setDraftReadyFor(null);
        if (!isMessengerV2 || !draftStorageKey) return;
        try { setText(window.localStorage.getItem(draftStorageKey) || ''); }
        catch { setText(''); }
        setEditing(null);
        setReplyTo(null);
        setDraftReadyFor(draftStorageKey);
    }, [draftStorageKey, isMessengerV2]);
    useEffect(() => {
        if (!isMessengerV2 || !draftStorageKey || draftReadyFor !== draftStorageKey || editing) return;
        try {
            if (text) window.localStorage.setItem(draftStorageKey, text);
            else window.localStorage.removeItem(draftStorageKey);
        } catch { /* storage may be disabled */ }
    }, [text, draftStorageKey, isMessengerV2, editing, draftReadyFor]);


    const [typingUsers, setTypingUsers] = useState([]);       // для открытого чата
    const [typingByChat, setTypingByChat] = useState({});     // для списка чатов
    const [search, setSearch] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [v2MobileSearch, setV2MobileSearch] = useState(false);
    const [visibleViewport, setVisibleViewport] = useState(null);
    const [chatFilter, setChatFilter] = useState('all');
    const [messageSearchOpen, setMessageSearchOpen] = useState(false);
    const [messageQuery, setMessageQuery] = useState('');
    const [messageMatchIndex, setMessageMatchIndex] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [pendingFiles, setPendingFiles] = useState([]);
    const [dragFilesOver, setDragFilesOver] = useState(false);
    const dragDepth = useRef(0);
    const acceptsFiles = (event) => Array.from(event.dataTransfer?.types || []).includes('Files');
    const handleDragEnter = (event) => {
        if (!isMessengerV2 || !chatId || uploading || !acceptsFiles(event)) return;
        event.preventDefault();
        dragDepth.current += 1;
        setDragFilesOver(true);
    };
    const handleDragOver = (event) => {
        if (!isMessengerV2 || !chatId || uploading || !acceptsFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    };
    const handleDragLeave = (event) => {
        if (!acceptsFiles(event)) return;
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragFilesOver(false);
    };
    const handleFileDrop = (event) => {
        if (!isMessengerV2 || !chatId || uploading || !acceptsFiles(event)) return;
        event.preventDefault();
        dragDepth.current = 0;
        setDragFilesOver(false);
        const incoming = Array.from(event.dataTransfer.files || []);
        if (incoming.length) setPendingFiles((current) => [...current, ...incoming].slice(0, 20));
    };
    const [attachmentCaptions, setAttachmentCaptions] = useState({});
    const [attachmentProgress, setAttachmentProgress] = useState(0);
    const [attachmentIndex, setAttachmentIndex] = useState(0);
    const attachmentRetriesRef = useRef(new Map());
    const [viewerIndex, setViewerIndex] = useState(null);
    const [showMembers, setShowMembers] = useState(false);
    const [showGallery, setShowGallery] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const [contextMenuClosing, setContextMenuClosing] = useState(false);
    const contextCloseTimer = useRef(null);
    const openMessageMenu = (menu) => {
        clearTimeout(contextCloseTimer.current);
        setContextMenuClosing(false);
        setContextMenu(menu);
    };
    const closeMessageMenu = () => {
        if (!contextMenu || contextMenuClosing) return;
        if (!isMessengerV2 || window.innerWidth >= 768 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setContextMenu(null);
            return;
        }
        setContextMenuClosing(true);
        clearTimeout(contextCloseTimer.current);
        contextCloseTimer.current = setTimeout(() => { setContextMenu(null); setContextMenuClosing(false); }, 180);
    };
    useEffect(() => () => clearTimeout(contextCloseTimer.current), []);

    const [highlightId, setHighlightId] = useState(null);
    const [mentionQuery, setMentionQuery] = useState(null);
    const [chatMenu, setChatMenu] = useState(null);
    const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
    const [panel, setPanel] = useState(null);
    const [attachMenu, setAttachMenu] = useState(false);
    const [reportTarget, setReportTarget] = useState(null);

    const [recording, setRecording] = useState(false);
    const [recordingSec, setRecordingSec] = useState(0);
    const [recordAnalyser, setRecordAnalyser] = useState(null);
    const recordAudioContextRef = useRef(null);
    const [voiceDraft, setVoiceDraft] = useState(null);
    const voiceDraftUrlRef = useRef(null);
    const recordGestureRef = useRef(null);
    const recordCancelRef = useRef(false);
    const [recordGesture, setRecordGesture] = useState('');
    const [recordLift, setRecordLift] = useState(0);
    const [recordLocked, setRecordLocked] = useState(false);
    const clearVoiceDraft = () => {
        if (voiceDraftUrlRef.current) URL.revokeObjectURL(voiceDraftUrlRef.current);
        voiceDraftUrlRef.current = null;
        setVoiceDraft(null);
    };
    useEffect(() => () => {
        if (voiceDraftUrlRef.current) URL.revokeObjectURL(voiceDraftUrlRef.current);
    }, []);

    const mediaRecorderRef = useRef(null);
    const recChunksRef = useRef([]);
    const recMimeRef = useRef('audio/webm');
    const recTimerRef = useRef(null);

    const scrollRef = useRef(null);
    const nearBottomRef = useRef(true);
    const ownSendPendingRef = useRef(false);
    const keyboardResizeRef = useRef(null);
    const [showJumpToLatest, setShowJumpToLatest] = useState(false);
    const [unseenCount, setUnseenCount] = useState(0);
    const chatListScrollRef = useRef(null);
    const typingTimeout = useRef(null);
    const typingClearTimers = useRef(new Map()); // key: chatId:userId
    const fileRef = useRef(null);
    const mediaFileRef = useRef(null);
    const textareaRef = useRef(null);
    const v2SearchRef = useRef(null);
    const needsInitialScroll = useRef(false);
    const mediaFollowChatRef = useRef(null);
    // Bounded history rendering (first phase of virtualization). Keep an anchor
    // when prepending older rows, including rows with images of variable height.
    const [historyStart, setHistoryStart] = useState(0);
    const [historyEnd, setHistoryEnd] = useState(null); // null follows newest messages
    const prependAnchorRef = useRef(null);
    const historyCount = 120;
    const loadOlderServerHistory = async () => {
        if (!chatId || !token || !hasMoreServerHistory || loadingOlderHistoryRef.current || !messages.length) return;
        loadingOlderHistoryRef.current = true;
        const activeChatId = chatId;
        const requestSeq = messagesFetchSeqRef.current;
        const oldestId = messages[0].id;
        const viewport = scrollRef.current;
        if (viewport) prependAnchorRef.current = { height: viewport.scrollHeight, top: viewport.scrollTop };
        try {
            const result = await api(`/chats/${activeChatId}/messages?before=${encodeURIComponent(oldestId)}`, { token });
            if (messagesFetchSeqRef.current !== requestSeq) return;
            const older = result.messages || [];
            setMessages((current) => {
                const known = new Set(current.map((item) => item.id));
                return [...older.filter((item) => !known.has(item.id)), ...current];
            });
            setHistoryStart(0);
            setHasMoreServerHistory(Boolean(result.hasMore));
        } catch (err) {
            prependAnchorRef.current = null;
            console.error('Не удалось загрузить ранние сообщения', err);
        } finally {
            loadingOlderHistoryRef.current = false;
        }
    };
    const revealOlder = () => {
        const el = scrollRef.current;
        if (!el) return;
        if (historyStart === 0) { if (hasMoreServerHistory) void loadOlderServerHistory(); return; }
        prependAnchorRef.current = { height: el.scrollHeight, top: el.scrollTop };
        const nextStart = Math.max(0, historyStart - historyCount);
        let start = nextStart;
        while (start > 0 && messages[start]?.albumId && messages[start - 1]?.albumId === messages[start].albumId) start--;
        setHistoryEnd(Math.min(messages.length, start + historyCount * 2));
        setHistoryStart(start);
    };
    const revealNewer = () => {
        const el = scrollRef.current;
        const anchor = el?.querySelector('[data-message-row="true"]');
        if (anchor) prependAnchorRef.current = { nodeId: anchor.id, top: anchor.getBoundingClientRect().top };
        const nextEnd = Math.min(messages.length, (historyEnd ?? messages.length) + historyCount);
        let end = nextEnd;
        while (end < messages.length && messages[end - 1]?.albumId && messages[end]?.albumId === messages[end - 1].albumId) end++;
        setHistoryEnd(end === messages.length ? null : end);
        setHistoryStart(Math.max(0, end - historyCount * 2));
    };
    const jumpToLatest = () => {
        setHistoryStart(Math.max(0, messages.length - historyCount));
        setHistoryEnd(null);
        nearBottomRef.current = true;
        setShowJumpToLatest(false);
        setUnseenCount(0);
        requestAnimationFrame(() => requestAnimationFrame(() => {
            const el = scrollRef.current;
            if (el) el.scrollTop = el.scrollHeight;
        }));
    };
    useLayoutEffect(() => {
        if (!prependAnchorRef.current) return;
        const anchor = prependAnchorRef.current;
        prependAnchorRef.current = null;
        const el = scrollRef.current;
        if (!el) return;
        if (anchor.nodeId) {
            const node = document.getElementById(anchor.nodeId);
            if (node) el.scrollTop += node.getBoundingClientRect().top - anchor.top;
        } else el.scrollTop = anchor.top + el.scrollHeight - anchor.height;
    }, [historyStart, historyEnd]);


    useEffect(() => {
        if (!isMessengerV2 || !v2MobileSearch) return;
        v2SearchRef.current?.focus();
    }, [isMessengerV2, v2MobileSearch]);

    useEffect(() => {
        if (!isMessengerV2 || !chatId || !textareaRef.current) return;
        const field = textareaRef.current;
        field.style.height = 'auto';
        field.style.height = Math.min(field.scrollHeight, 160) + 'px';
    }, [isMessengerV2, chatId, text]);

    // iOS Safari/WebView keeps the layout viewport tall while the keyboard shrinks
    // the visual viewport. Constrain only the opt-in chat to the visible region.
    useEffect(() => {
        if (!isMessengerV2 || !chatId || !window.matchMedia('(max-width: 767px)').matches) {
            setVisibleViewport(null);
            return;
        }
        const viewport = window.visualViewport;
        if (!viewport) return;
        let frame = 0;
        const update = () => {
            cancelAnimationFrame(frame);
            const el = scrollRef.current;
            const wasAtBottom = el ? el.scrollHeight - el.clientHeight - el.scrollTop < 120 : false;
            const previousTop = el?.scrollTop ?? 0;
            frame = requestAnimationFrame(() => {
                if (document.activeElement === textareaRef.current) keyboardResizeRef.current = { wasAtBottom, previousTop };
                setVisibleViewport({
                    top: Math.max(0, viewport.offsetTop),
                    height: Math.max(240, viewport.height),
                    keyboard: window.innerHeight - (viewport.offsetTop + viewport.height) > 120,
                });
            });
        };
        update();
        viewport.addEventListener('resize', update);
        viewport.addEventListener('scroll', update);
        window.addEventListener('orientationchange', update);
        return () => {
            cancelAnimationFrame(frame);
            viewport.removeEventListener('resize', update);
            viewport.removeEventListener('scroll', update);
            window.removeEventListener('orientationchange', update);
        };
    }, [isMessengerV2, chatId]);

    // Preserve reading position across iOS visualViewport keyboard animations.
    useLayoutEffect(() => {
        const anchor = keyboardResizeRef.current;
        keyboardResizeRef.current = null;
        const el = scrollRef.current;
        if (!anchor || !el || !isMessengerV2) return;
        el.scrollTop = anchor.wasAtBottom ? el.scrollHeight : anchor.previousTop;
        nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        setShowJumpToLatest(!nearBottomRef.current);
    }, [visibleViewport?.height, visibleViewport?.top, isMessengerV2]);

    const canGroupMessages = (a, b) => {
        if (!a || !b || a.deletedAt || b.deletedAt) return false;
        if (a.sender?.id !== b.sender?.id || messageDayKey(a.createdAt) !== messageDayKey(b.createdAt)) return false;
        const distance = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        return Number.isFinite(distance) && distance >= 0 && distance <= 5 * 60 * 1000;
    };

    const albumAt = (index) => {
        const first = messages[index];
        if (!isMessengerV2 || !first?.albumId || first.type !== 'image' || first.deletedAt) return null;
        if (index > 0 && messages[index - 1]?.albumId === first.albumId && messages[index - 1]?.sender?.id === first.sender?.id && messages[index - 1]?.type === 'image' && !messages[index - 1]?.deletedAt && firstUnreadId !== first.id) return 'continuation';
        const items = [];
        for (let pos = index; pos < messages.length; pos++) {
            const current = messages[pos];
            if (current.albumId !== first.albumId || current.sender?.id !== first.sender?.id || current.type !== 'image' || current.deletedAt || (pos > index && firstUnreadId === current.id)) break;
            items.push(current);
        }
        return items.length > 1 ? items : null;
    };

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
        let el = document.getElementById(`msg-${id}`);
        if (!el && isMessengerV2) {
            const targetIndex = messages.findIndex((message) => message.id === id);
            if (targetIndex >= 0) {
                let start = Math.max(0, targetIndex - 40);
                while (start > 0 && messages[start]?.albumId && messages[start - 1]?.albumId === messages[start].albumId) start--;
                setHistoryStart(start);
                setHistoryEnd(Math.min(messages.length, start + historyCount * 2));
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'instant', block: 'center' });
                    setHighlightId(id);
                    setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 1800);
                }));
            }
            return;
        }
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
        const requestSeq = ++messagesFetchSeqRef.current;
        socketDuringFetchRef.current = [];
        messagesFetchPendingRef.current = true;
        loadingOlderHistoryRef.current = false;
        setMessages([]);
        setHasMoreServerHistory(false);
        setFirstUnreadId(null);
        needsInitialScroll.current = true;
        nearBottomRef.current = true;
        setShowJumpToLatest(false);
        setUnseenCount(0);
        api(`/chats/${chatId}/messages${linkedMessageId ? `?focus=${encodeURIComponent(linkedMessageId)}` : ''}`, { token }).then((r) => {
            if (requestSeq !== messagesFetchSeqRef.current) return;
            setHasMoreServerHistory(Boolean(r.hasMore));
            const mergeLive = (loaded) => {
                const byId = new Map(loaded.map((m) => [m.id, m]));
                for (const m of socketDuringFetchRef.current) byId.set(m.id, m);
                socketDuringFetchRef.current = [];
                messagesFetchPendingRef.current = false;
                return [...byId.values()].sort((a, b) =>
                    new Date(a.createdAt) - new Date(b.createdAt) || a.id.localeCompare(b.id));
            };
            if (Array.isArray(r)) {
                let start = isMessengerV2 ? Math.max(0, r.length - historyCount) : 0;
                while (start > 0 && r[start]?.albumId && r[start - 1]?.albumId === r[start].albumId) start--;
                setHistoryEnd(null);
                setHistoryStart(start);
                setChatReceipts([]);
                setMessages(mergeLive(r)); setPinned(null); setMyRole('member');
            } else {
                const incoming = r.messages || [];
                const focus = linkedMessageId || r.firstUnreadId;
                const focusIndex = focus ? incoming.findIndex((m) => m.id === focus) : -1;
                let start = isMessengerV2 ? Math.max(0, focusIndex >= 0 ? focusIndex - 30 : incoming.length - historyCount) : 0;
                while (start > 0 && incoming[start]?.albumId && incoming[start - 1]?.albumId === incoming[start].albumId) start--;
                setHistoryEnd(focusIndex >= 0 && isMessengerV2 ? Math.min(incoming.length, start + historyCount * 2) : null);
                setHistoryStart(start);
                setChatReceipts(r.receipts || []);
                if (socket && isMessengerV2) {
                    const recentIncoming = [...incoming].reverse().find((m) => m.senderId !== user.id && m.sender?.id !== user.id);
                    if (recentIncoming) socket.emit('message:received', { chatId, messageId: recentIncoming.id });
                }
                setMessages(mergeLive(incoming));
                setPinned(r.pinned || null);
                setMyRole(r.myRole || 'member');
                setFirstUnreadId(r.firstUnreadId || null);
            }
        }).catch((error) => { if (requestSeq === messagesFetchSeqRef.current) { messagesFetchPendingRef.current = false; console.error('Не удалось загрузить сообщения чата', error); } });
        socket?.emit('chat:join', chatId);
        notifications.markChatRead?.(chatId);
    }, [chatId, token, socket]); // eslint-disable-line

    useEffect(() => {
        if (!socket) return;
        const onNew = (m) => {
            if (m.chatId === chatId) {
                if (isMessengerV2 && (m.senderId === user.id || m.sender?.id === user.id)) {
                    ownSendPendingRef.current = true;
                    nearBottomRef.current = true;
                    setShowJumpToLatest(false);
                }
                if (isMessengerV2 && m.senderId !== user.id && m.sender?.id !== user.id) {
                    socket.emit('message:received', { chatId, messageId: m.id });
                    if (nearBottomRef.current && document.visibilityState === 'visible') socket.emit('chat:read', { chatId });
                }
                if (!nearBottomRef.current && m.senderId !== user.id && m.sender?.id !== user.id) setUnseenCount((n) => n + 1);
                if (messagesFetchPendingRef.current) socketDuringFetchRef.current.push(m);
                setMessages((prev) => prev.some((item) => item.id === m.id) ? prev : [...prev, m]);
            }
            reloadChats();
        };
        const onEdited = (m) => setMessages((p) => p.map((x) => (x.id === m.id ? m : x)));
        const onDeleted = ({ messageId, scope }) => {
            if (scope === 'me') { setMessages(p => p.filter(x => x.id !== messageId)); return; }
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

        const onReceipt = ({ chatId: cid, userId: reader, readAt, deliveredAt }) => {
            if (cid !== chatId) return;
            setChatReceipts((prev) => {
                const item = prev.find((x) => x.userId === reader) || { userId: reader };
                const newer = { ...item, ...(readAt ? { lastRead: readAt } : {}), ...(deliveredAt ? { lastDelivered: deliveredAt } : {}) };
                return [...prev.filter((x) => x.userId !== reader), newer];
            });
        };
        const onUserOffline = ({ userId: uid, lastSeen }) => {
            if (!lastSeen) return;
            setChats((prev) => prev.map((chat) => ({
                ...chat, members: chat.members.map((member) => member.id === uid ? { ...member, lastSeen } : member),
            })));
        };
        socket.on('user:offline', onUserOffline);
        socket.on('chat:receipt', onReceipt);
        socket.on('message:new', onNew);
        socket.on('message:edited', onEdited);
        socket.on('message:deleted', onDeleted);
        socket.on('reaction:update', onReaction);
        socket.on('typing', onTyping);
        socket.on('chat:pinned', onPinned);
        socket.on('chat:deleted', onChatDeleted);
        socket.on('chat:updated', onChatUpdated);

        return () => {
            socket.off('user:offline', onUserOffline);
            socket.off('chat:receipt', onReceipt);
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
        observer.observe(el.firstElementChild || el);
        // Only watch recent messages: observing every image-heavy history row is expensive.
        const tail = Array.from(el.children).slice(isMessengerV2 ? -10 : undefined);
        tail.forEach((node) => observer.observe(node));
        const onMediaLoad = () => followBottom();
        el.addEventListener('load', onMediaLoad, true);
        el.addEventListener('loadedmetadata', onMediaLoad, true);
        el.addEventListener('wheel', stopFollowing, { passive: true });
        el.addEventListener('touchstart', stopFollowing, { passive: true });
        el.addEventListener('pointerdown', stopFollowing, { passive: true });
        followBottom();
        return () => {
            cancelAnimationFrame(raf);
            observer.disconnect();
            el.removeEventListener('load', onMediaLoad, true);
            el.removeEventListener('loadedmetadata', onMediaLoad, true);
            el.removeEventListener('wheel', stopFollowing);
            el.removeEventListener('touchstart', stopFollowing);
            el.removeEventListener('pointerdown', stopFollowing);
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
                        // offsetTop is relative to an offset parent, not necessarily the scroll container.
                        el.scrollTop += target.getBoundingClientRect().top - el.getBoundingClientRect().top - 40;
                        setHighlightId(firstUnreadId);
                        setTimeout(() => setHighlightId((cur) => (cur === firstUnreadId ? null : cur)), 1800);
                    } else el.scrollTop = el.scrollHeight;
                } else el.scrollTop = el.scrollHeight;
            });
            needsInitialScroll.current = false;
            return;
        }
        // Own new messages must remain visible above the composer, never behind the jump button.
        if (isMessengerV2 && ownSendPendingRef.current && messages.length) {
            ownSendPendingRef.current = false;
            nearBottomRef.current = true;
            setShowJumpToLatest(false);
            requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
            return;
        }
        // Do not yank the reader away from older messages when a new message arrives.
        if (messages.length > 0 && nearBottomRef.current && !linkedMessageId && (!isMessengerV2 || historyEnd === null)) {
            const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
            const distance = el.scrollHeight - el.clientHeight - el.scrollTop;
            el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion || (isMessengerV2 && distance > el.clientHeight * 2) ? 'instant' : 'smooth' });
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
            if (isMessengerV2) {
                ownSendPendingRef.current = true;
                jumpToLatest();
            }
            socket.emit('message:send', { chatId, content: text, type: 'text', replyToId: replyTo?.id });
        }
        if (isMessengerV2 && draftStorageKey) {
            try { window.localStorage.removeItem(draftStorageKey); } catch {}
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
        try {
            const outcome = await sendAttachmentBatch({
                files: pendingFiles, captions: attachmentCaptions, replyToId: replyTo?.id,
                chatId, token, socket, upload: uploadFileWithProgress,
                retryCache: attachmentRetriesRef.current,
                onProgress: setAttachmentProgress, onFileSent: setAttachmentIndex,
            });
            if (outcome.error) {
                setPendingFiles(outcome.remaining);
                setAttachmentCaptions(outcome.captions);
                setAttachmentProgress(0);
                alert('Не все файлы отправлены: ' + outcome.error.message);
            } else {
                setPendingFiles([]);
                setAttachmentCaptions({});
                setReplyTo(null);
            }
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
            if (isMessengerV2) {
                try {
                    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                    if (AudioContextClass) {
                        const context = new AudioContextClass();
                        const source = context.createMediaStreamSource(stream);
                        const analyser = context.createAnalyser();
                        analyser.fftSize = 1024;
                        source.connect(analyser);
                        recordAudioContextRef.current = context;
                        setRecordAnalyser(analyser);
                    }
                } catch (error) { console.warn('[voice] Live waveform unavailable', error); }
            }
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
                setRecordAnalyser(null);
                const context = recordAudioContextRef.current;
                recordAudioContextRef.current = null;
                if (context) context.close().catch(() => {});
                const blob = new Blob(recChunksRef.current, { type: recMimeRef.current });
                if (recordCancelRef.current || blob.size < 1000) return;
                const ext = extFromMime(recMimeRef.current);
                const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: recMimeRef.current });
                if (!isMessengerV2) { await sendFile(file, 'voice'); return; }
                if (voiceDraftUrlRef.current) URL.revokeObjectURL(voiceDraftUrlRef.current);
                const url = URL.createObjectURL(blob);
                voiceDraftUrlRef.current = url;
                setVoiceDraft({ file, url });
            };
            recordCancelRef.current = false;
            clearVoiceDraft();
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
        recordCancelRef.current = cancel;
        setRecordGesture('');
        setRecordLift(0);
        setRecordLocked(false);
        recordGestureRef.current = null;
        if (mr.state !== 'inactive') mr.stop();
        mediaRecorderRef.current = null;
    };

    const sendVoiceDraft = async () => {
        if (!voiceDraft || uploading) return;
        const file = voiceDraft.file;
        clearVoiceDraft();
        await sendFile(file, 'voice');
    };
    // Pointer listeners stay on document: the microphone button is replaced by
    // the recording UI immediately, so button-level pointerup would be lost.
    const voicePressRef = useRef(null);
    const voicePressCleanupRef = useRef(null);
    const clearVoicePress = () => {
        voicePressCleanupRef.current?.();
        voicePressCleanupRef.current = null;
    };
    useEffect(() => () => clearVoicePress(), []);
    const onVoicePress = (event) => {
        if (!isMessengerV2 || voicePressRef.current || recording) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();
        try { window.getSelection()?.removeAllRanges(); } catch {}
        setRecordLocked(false);
        setRecordLift(0);
        const gesture = { x: event.clientX, y: event.clientY, finished: false, action: '' };
        voicePressRef.current = gesture;
        const move = (e) => {
            if (gesture.finished || e.pointerId !== event.pointerId) return;
            const dx = e.clientX - gesture.x;
            const dy = e.clientY - gesture.y;
            gesture.action = dx < -75 ? 'cancel' : dy < -75 ? 'lock' : '';
            setRecordLift(dx < -75 ? 0 : Math.min(88, Math.max(0, -dy)));
            setRecordGesture(gesture.action);
        };
        const finish = (e) => {
            if (e.pointerId !== event.pointerId || gesture.finished) return;
            gesture.finished = true;
            if (e.type === 'pointercancel') gesture.action = 'cancel';
            clearVoicePress();
            voicePressRef.current = null;
            setRecordGesture('');
            setRecordLift(0);
            if (gesture.action === 'lock') { setRecordLocked(true); try { navigator.vibrate?.(25); } catch {} }
            // Upward swipe locks the recording; release otherwise stops into preview.
            if (gesture.action !== 'lock') {
                if (mediaRecorderRef.current) stopRecording(gesture.action === 'cancel');
                else gesture.stopWhenReady = gesture.action === 'cancel' ? 'cancel' : 'preview';
            }
        };
        const preventSelection = (e) => e.preventDefault();
        document.addEventListener('selectstart', preventSelection, true);
        document.addEventListener('contextmenu', preventSelection, true);
        document.addEventListener('pointermove', move, { passive: true });
        document.addEventListener('pointerup', finish);
        document.addEventListener('pointercancel', finish);
        voicePressCleanupRef.current = () => {
            document.removeEventListener('selectstart', preventSelection, true);
            document.removeEventListener('contextmenu', preventSelection, true);
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', finish);
            document.removeEventListener('pointercancel', finish);
        };
        startRecording().then(() => {
            if (gesture.stopWhenReady && mediaRecorderRef.current) stopRecording(gesture.stopWhenReady === 'cancel');
        });
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
        const forwardedAlbum = isMessengerV2 && forwarding?.albumId ? messages.filter((m) => m.albumId === forwarding.albumId && m.type === 'image' && !m.deletedAt) : [];
        if (forwardedAlbum.length > 1) {
            const albumId = crypto.randomUUID();
            forwardedAlbum.forEach((m) => socket.emit('message:send', { chatId: target, content: m.content, type: 'image', caption: m.caption, albumId, forwardedFrom: { userId: m.sender.id, fullName: m.sender.fullName } }));
            setForwarding(null);
            nav(`/app/chats/${target}`);
            return;
        }
        socket.emit('message:send', {
            chatId: target, content: forwarding.content, type: forwarding.type,
            caption: forwarding.caption,
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

    const [deleteChoice, setDeleteChoice] = useState(null);
    const deleteChat = (chat) => { if (chat) setDeleteChoice({ kind: 'chat', chat }); };
    const performDelete = async (scope) => {
        const choice = deleteChoice;
        setDeleteChoice(null);
        if (!choice) return;
        if (choice.kind === 'message') {
            socket.emit('message:delete', { messageId: choice.message.id, scope }, (answer) => {
                if (answer?.error) alert(answer.error);
            });
            return;
        }
        const chat = choice.chat;
        try {
            await api(`/chats/${chat.id}?scope=${scope}`, { method: 'DELETE', token });
            setChats(prev => prev.filter(c => c.id !== chat.id));
            if (chatId === chat.id) nav('/app/chats');
        } catch (e) { alert(e.message); }
    };

    const contextActions = (m) => {
        const isOwn = m.sender.id === user.id;
        const canPin = activeChat?.type === 'GROUP'
            ? activeChat.members.find((x) => x.id === user.id)?.role === 'admin' ||
            !activeChat.members.find((x) => x.id === user.id)?.role
            : true;
        const albumItems = isMessengerV2 && m.albumId ? messages.filter((x) => x.albumId === m.albumId && x.type === 'image' && !x.deletedAt) : [];
        const actions = [
            { id: 'react', label: '❤️ Реакция' },
            { id: 'reply', label: '↩ Ответить' },
            { id: 'copy', label: '📋 Копировать', only: m.type === 'text' },
            { id: 'forward', label: albumItems.length > 1 ? '↪ Переслать альбом' : '↪ Переслать' },
            { id: 'album-select', label: '☑ Выбрать фото', only: albumItems.length > 1 },
            { id: 'album-download', label: '⬇ Скачать альбом ZIP', only: albumItems.length > 1 },
            { id: 'pin', label: '📌 Закрепить', only: !m.deletedAt && canPin },
            { id: 'report', label: '🚩 Пожаловаться', only: !isOwn && !m.deletedAt, danger: true },
            { id: 'edit', label: '✏️ Изменить', only: isOwn && m.type === 'text' && !m.deletedAt },
            { id: 'delete', label: '🗑️ Удалить', only: !m.deletedAt, danger: true },
        ].filter((a) => a.only === undefined || a.only);

        const handler = (id) => {
            closeMessageMenu();
            switch (id) {
                case 'react': toggleReaction(m.id, '❤️'); break;
                case 'reply': setReplyTo(m); break;
                case 'copy': navigator.clipboard?.writeText(m.content); break;
                case 'forward': setForwarding(m); break;
                case 'album-select': window.dispatchEvent(new CustomEvent('mrr:album-action', { detail: { albumId: m.albumId, action: 'select' } })); break;
                case 'album-download': window.dispatchEvent(new CustomEvent('mrr:album-action', { detail: { albumId: m.albumId, action: 'download' } })); break;
                case 'pin': pinMessage(m); break;
                case 'report': setReportTarget({ type: 'message', id: m.id }); break;
                case 'edit': setEditing(m); setText(m.content); break;
                case 'delete':
                    setDeleteChoice({ kind: 'message', message: m });
                    break;
            }
        };
        return { actions, handler };
    };

    const receiptStatusFor = (message) => {
        if (!isMessengerV2 || activeChat?.type !== 'DIRECT' || message.sender?.id !== user.id) return null;
        const other = activeChat.members.find((member) => member.id !== user.id);
        const cursor = chatReceipts.find((entry) => entry.userId === other?.id);
        const sentAt = new Date(message.createdAt).getTime();
        if (cursor?.lastRead && new Date(cursor.lastRead).getTime() >= sentAt) return 'read';
        if (cursor?.lastDelivered && new Date(cursor.lastDelivered).getTime() >= sentAt) return 'delivered';
        return 'sent';
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
        <>
        {deleteChoice && createPortal(<div role="presentation" className="fixed inset-0 z-[250] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onMouseDown={e=>{if(e.target===e.currentTarget)setDeleteChoice(null)}}>
            <div role="dialog" aria-modal="true" aria-label="Выберите способ удаления" className="w-full max-w-sm space-y-3 rounded-2xl border border-current/15 bg-white p-5 text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-white">
                <h2 className="text-lg font-bold">Удаление {deleteChoice.kind==='message'?'сообщения':'чата'}</h2>
                <p className="text-sm opacity-70">У кого удалить {deleteChoice.kind==='message'?'сообщение':'переписку'}?</p>
                <button type="button" className="w-full rounded-xl border border-current/20 p-3 text-left" onClick={()=>performDelete('me')}>Удалить только у меня</button>
                {(deleteChoice.kind==='message' ? deleteChoice.message.sender?.id===user.id : deleteChoice.chat.type==='DIRECT' || deleteChoice.chat.myRole==='admin')&&<button type="button" className="w-full rounded-xl border border-rose-500/40 p-3 text-left text-rose-600 dark:text-rose-300" onClick={()=>performDelete('all')}>Удалить у всех</button>}
                <button type="button" className="w-full rounded-xl px-3 py-2 text-sm opacity-70" onClick={()=>setDeleteChoice(null)}>Отмена</button>
            </div>
        </div>,document.body)}
        <div
            className={`${isChatRoom ? 'fixed inset-0 md:left-64 z-40 flex min-w-0 max-w-full overflow-hidden overscroll-none bg-ink-900' : 'flex'} ${isMessengerV2 ? 'mrr-messenger-v2' : ''} ${isMessengerV2 && isChatRoom ? 'mrr-v2-chat-room' : ''} ${visibleViewport?.keyboard ? 'mrr-v2-keyboard-open' : ''}`}
            style={isChatRoom ? {
                paddingTop: visibleViewport?.keyboard ? 0 : 'env(safe-area-inset-top, 0px)',
                paddingBottom: isMessengerV2 ? 0 : (visibleViewport?.keyboard ? 0 : 'env(safe-area-inset-bottom, 0px)'),
                ...(isMessengerV2 && visibleViewport ? {
                    top: visibleViewport.top,
                    bottom: 'auto',
                    height: visibleViewport.height,
                } : {}),
            } : undefined}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleFileDrop}
            onClick={() => {
                if (contextMenu) setContextMenu(null);
                if (chatMenu) setChatMenu(null);
                if (headerMenuOpen) setHeaderMenuOpen(false);
                if (attachMenu) setAttachMenu(false);
            }}
        >
            {dragFilesOver && isMessengerV2 && chatId && (
                <div className="mrr-v2-drop-overlay" aria-hidden="true">
                    <div className="mrr-v2-drop-overlay-label">📎 Отпустите файлы для добавления</div>
                </div>
            )}
            {/* Список чатов */}
            <aside className={`${chatId ? 'hidden md:flex' : 'flex'} md:w-80 w-full flex-col border-r border-white/5 bg-ink-800/50 min-h-0`}>
                <div className="p-4 border-b border-white/5 shrink-0">
                    <div className="flex items-center gap-1">
                        <h2 className="text-xl font-bold">Чаты</h2>
                        {isMessengerV2 && <span className="mrr-v2-label" aria-label="Новый интерфейс">2.0</span>}
                        <div className="ml-auto flex items-center gap-1">
                            {isMessengerV2 && <button type="button" className="mrr-v2-search-toggle md:hidden" aria-label={v2MobileSearch ? 'Закрыть поиск чатов' : 'Найти чат'} aria-expanded={v2MobileSearch} onClick={() => { setV2MobileSearch((value) => !value); setSearch(''); }}>{v2MobileSearch ? '✕' : '⌕'}</button>}
                            <NewChatButton onCreated={(id) => nav(`/app/chats/${id}`)} />
                        </div>
                    </div>
                    {isMessengerV2 && v2MobileSearch && <div className="mrr-v2-search-wrap md:hidden">
                        <input ref={v2SearchRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Имя или сообщение…" className="mrr-v2-search-input" aria-label="Поиск по списку чатов" />
                    </div>}
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
                                className="relative group mrr-v2-chat-item"
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
                                        <div className="flex items-center gap-2 min-w-0"><div className="font-semibold truncate flex-1">{title}</div>{isMessengerV2 && c.lastMessage?.createdAt && <time className="mrr-chat-time" dateTime={c.lastMessage.createdAt}>{new Date(c.lastMessage.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</time>}</div>
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
                        <header className="relative z-30 px-3 py-2.5 md:px-4 border-b border-white/10 bg-ink-800/80 backdrop-blur flex items-center gap-2 shrink-0 mrr-v2-chat-header">
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
                                                    ? 'в сети' : presenceLabel(activeChat?.members.find((m) => m.id !== user.id)?.lastSeen)}
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
                                        {allowUIChoice && <button type="button" onClick={() => { setHeaderMenuOpen(false); changeMessengerUI(isMessengerV2 ? "classic" : "new"); }} className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-white/5">{isMessengerV2 ? "↩ Классический интерфейс" : "✨ Новый интерфейс 2.0"}</button>}
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
                            const wasNearBottom = nearBottomRef.current;
                            nearBottomRef.current = nearBottom;
                            if (isMessengerV2 && nearBottom && !wasNearBottom && document.visibilityState === 'visible') socket?.emit('chat:read', { chatId });
                            setShowJumpToLatest(!nearBottom);
                            if (nearBottom) setUnseenCount(0);
                        }} className="h-full w-full min-w-0 max-w-full overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 md:px-6 py-4 space-y-2">
                            {isMessengerV2 && historyStart > 0 && <button type="button" className="mrr-v2-load-history" onClick={revealOlder}>
                                ↑ Показать предыдущие сообщения {historyStart > 0 ? `(${historyStart})` : "(загрузить историю)"}
                            </button>}
                            {messages.map((m, index) => { if (isMessengerV2 && (index < historyStart || (historyEnd !== null && index >= historyEnd))) return null; const album = albumAt(index); return album === 'continuation' ? null : (
                                <div key={m.id} id={`message-row-${m.id}`} data-message-row="true" className={isMessengerV2 ? 'mrr-v2-message-row' : 'space-y-2'}>
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
                                    {Array.isArray(album) && album.length > 1 ? <PhotoAlbum
                                        items={album}
                                        own={m.sender.id === user.id}
                                        onlineSet={onlineUsers}
                                        onOpen={openViewer}
                                        onProfile={() => goProfile(m.sender.username)}
                                        onContext={(item, event) => openMessageMenu({ x: event.clientX, y: event.clientY, message: item })}
                                    /> : <MessageBubble
                                    compact={isMessengerV2 && canGroupMessages(messages[index - 1], m) && firstUnreadId !== m.id}
                                    groupEnd={isMessengerV2 && !canGroupMessages(m, messages[index + 1])}
                                    v2={isMessengerV2}
                                    m={m}
                                    receiptStatus={receiptStatusFor(m)}
                                    replyAlbumImages={m.replyTo?.albumId ? messages.filter((x) => x.albumId === m.replyTo.albumId && x.type === 'image' && !x.deletedAt).slice(0, 4) : []}
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
                                        openMessageMenu({ x: clientX, y: clientY, message: m });
                                    }}
                                />}
                                </div>
                            ); })}
                            {isMessengerV2 && historyEnd !== null && historyEnd < messages.length && (
                                <button type="button" className="mrr-v2-load-history" onClick={revealNewer}>
                                    ↓ Показать следующие сообщения ({messages.length - historyEnd})
                                </button>
                            )}
                        </div>
                        {showJumpToLatest && !ownSendPendingRef.current && (
                            <button type="button"
                                aria-label={unseenCount ? `К последним сообщениям, новых: ${unseenCount}` : 'К последним сообщениям'}
                                title="К последним сообщениям"
                                onClick={() => {
                                    if (isMessengerV2) { jumpToLatest(); return; }
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
                        <div className="border-t border-white/10 p-2.5 md:p-3 space-y-2 shrink-0 bg-ink-900/95 backdrop-blur relative mrr-v2-composer">
                            {replyTo && (
                                <div className="flex items-center gap-2 bg-ink-700/60 rounded-2xl px-3 py-2 text-sm">
                                    <div className="w-1 h-8 rounded bg-violet" />
                                    {replyTo.type === 'image' && <div className="mrr-v2-reply-preview">
                                        {(replyTo.albumId ? messages.filter((x) => x.albumId === replyTo.albumId && x.type === 'image' && !x.deletedAt).slice(0, 4) : [replyTo]).map((item) => <img key={item.id} src={resolveUrl(item.content)} alt="" />)}
                                    </div>}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-violet-soft text-xs font-bold">Ответ {replyTo.sender.fullName}</div>
                                        <div className="text-white/60 truncate">
                                            {replyTo.type === 'image' ? (replyTo.albumId ? '🖼️ Фотоальбом' : '🖼️ Изображение')
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

                            {isMessengerV2 && pendingFiles.length > 0 && (
                                <AttachmentEditorV2
                                    files={pendingFiles}
                                    captions={attachmentCaptions}
                                    onFilesChange={setPendingFiles}
                                    onCaptionsChange={setAttachmentCaptions}
                                    onCancel={() => { setPendingFiles([]); setAttachmentCaptions({}); }}
                                    onSend={sendPendingFiles}
                                    uploading={uploading}
                                    progress={attachmentProgress}
                                    sentCount={attachmentIndex}
                                />
                            )}
                            {!isMessengerV2 && pendingFiles.length > 0 && (
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

                            {pendingFiles.length > 0 ? null : voiceDraft && isMessengerV2 ? (
                                <div className="flex flex-col gap-2 rounded-2xl border p-3 select-none" style={{WebkitUserSelect: "none", WebkitTouchCallout: "none", background:'var(--bg-elev-2)', borderColor:'var(--border-strong)'}}>
                                    <div className="flex items-center gap-2 text-sm"><span>🎤</span><span>Прослушайте запись перед отправкой</span></div>
                                    <div className="w-full flex justify-center"><VoicePlayer src={voiceDraft.url} isOwn={false} preview /></div>
                                    <div className="flex items-center justify-end gap-2">
                                        <button type="button" onClick={clearVoiceDraft} className="btn-ghost !py-2 !px-3 text-sm select-none" style={{WebkitUserSelect: "none", WebkitTouchCallout: "none"}}>Удалить</button>
                                        <button type="button" disabled={uploading} onClick={sendVoiceDraft} className="btn-primary !py-2 !px-3 text-sm select-none" style={{WebkitUserSelect: "none", WebkitTouchCallout: "none"}}>Отправить ➤</button>
                                    </div>
                                </div>
                            ) : recording ? (
                                isMessengerV2 ? (
                                    <div className={`mrr-v2-recording-no-selection mrr-v2-voice-compose ${recordLocked ? 'mrr-v2-voice-compose-locked' : ''}`}>
                                        <div className="mrr-v2-voice-capsule">
                                            <span className="mrr-v2-recording-dot" aria-label="Идёт запись" />
                                            <span className="mrr-v2-voice-clock tabular-nums">{String(Math.floor(recordingSec / 60)).padStart(2, '0')}:{String(recordingSec % 60).padStart(2, '0')}</span>
                                            {recordLocked ? (
                                                <button type="button" className="mrr-v2-voice-cancel" onClick={() => stopRecording(true)}>Отмена</button>
                                            ) : (
                                                <span className="mrr-v2-voice-hint">{recordGesture === 'cancel' ? 'Отпустите для отмены' : '‹ Влево — отмена'}</span>
                                            )}
                                            {recordLocked && <div className="mrr-v2-voice-mini-wave">{recordAnalyser && <RecordingWaveform analyser={recordAnalyser} />}</div>}
                                        </div>
                                        <div className="mrr-v2-voice-floating-wrap">
                                            {!recordLocked && <div className={`mrr-v2-voice-lock-guide ${recordGesture === 'lock' ? 'is-ready' : ''}`} aria-hidden="true">
                                                <span>🔒</span><span>⌃</span>
                                            </div>}
                                            <button type="button"
                                                className={`mrr-v2-voice-floating-button ${recordLocked ? 'is-locked' : ''}`}
                                                style={recordLocked ? undefined : { transform: `translateY(-${recordLift}px)` }}
                                                onClick={recordLocked ? () => stopRecording(false) : undefined}
                                                aria-label={recordLocked ? 'Завершить запись и прослушать' : 'Запись голосового — поднимите палец для фиксации'}>
                                                {recordLocked ? '➤' : '🎤'}
                                            </button>
                                        </div>
                                        {recordGesture === 'lock' && !recordLocked && <div className="mrr-v2-voice-lock-toast">Отпустите — запись продолжится</div>}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 bg-pink/10 border border-pink/30 rounded-2xl px-3 py-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-pink animate-pulse" />
                                        <div className="flex-1"><div className="text-sm text-pink">Запись голосового…</div><div className="text-xs text-white/50">{recordingSec} сек</div></div>
                                        <button onClick={() => stopRecording(true)} className="btn-ghost !py-1.5 !px-3 text-xs">Отмена</button>
                                        <button onClick={() => stopRecording(false)} className="btn-primary !py-1.5 !px-3 text-xs">Отправить ➤</button>
                                    </div>
                                )
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
                                            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing && window.matchMedia('(min-width: 768px)').matches) { e.preventDefault(); send(); }
                                        }}
                                        placeholder="Написать сообщение…"
                                        className="input flex-1 min-w-0 resize-none max-h-40 !py-2.5 md:!py-3 text-base rounded-2xl mrr-v2-message-field" aria-label="Текст сообщения"
                                        autoComplete="off"
                                    />

                                    {text.trim() ? (
                                        <button onClick={send} className="btn-primary !p-2.5 md:!p-3 text-lg md:text-xl shrink-0 min-w-11 min-h-11 rounded-2xl" aria-label="Отправить сообщение">➤</button>
                                    ) : (
                                        <button onPointerDown={isMessengerV2 ? onVoicePress : undefined} onClick={isMessengerV2 ? (e) => e.preventDefault() : startRecording} onContextMenu={(e) => e.preventDefault()} className="btn-primary !p-2.5 md:!p-3 text-lg md:text-xl shrink-0 min-w-11 min-h-11 rounded-2xl select-none" style={{ touchAction: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }} title="Удерживайте для записи; вверх — закрепить, влево — отменить" aria-label="Удерживайте для записи голосового сообщения">🎤</button>
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
                                                        <span className="ml-2">{presenceLabel(m.lastSeen, onlineUsers.has(m.id))}</span>
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
                const menuHeight = Math.min(400, actions.length * 48 + 12);
                const previewHeight = selected.type === 'image' ? 132 : 78;
                const totalHeight = (selected.deletedAt ? 0 : 56) + previewHeight + menuHeight + 22;
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
                        <button type="button" className={`fixed inset-0 z-[70] mrr-v2-telegram-menu-scrim ${contextMenuClosing ? "is-closing" : ""}`} onClick={closeMessageMenu} aria-label="Закрыть действия с сообщением" />
                        <div className={`mrr-message-actions fixed z-[80] md:hidden mrr-v2-telegram-menu ${contextMenuClosing ? "is-closing" : ""}`}
                            style={{left, top, width:mobileWidth, maxHeight:'calc(100dvh - 24px)'}}
                            role="dialog" aria-modal="true" aria-label="Действия с сообщением">
                            {!selected.deletedAt && <div className="mrr-v2-telegram-reactions" aria-label="Быстрые реакции">
                                {quickReactions.map((emoji) => <button type="button" key={emoji}
                                    onClick={() => { toggleReaction(selected.id,emoji); closeMessageMenu(); }}
                                    aria-label={`Реакция ${emoji}`}>{emoji}</button>)}
                            </div>}
                            <div className={`mrr-v2-telegram-selected ${selected.sender.id === user.id ? 'is-own' : ''}`}>
                                {selected.type === 'image' && !selected.deletedAt ? <img className="mrr-v2-telegram-selected-image" src={resolveUrl(selected.content)} alt="Выбранное фото" /> : null}
                                <div className="mrr-v2-telegram-selected-author">{selected.sender.fullName}</div>
                                {selected.type !== 'image' && <div className="mrr-v2-telegram-selected-text">{previewText}</div>}
                            </div>
                            <div className="mrr-v2-telegram-actions" style={{maxHeight:menuHeight}}>
                                {actions.filter((a) => a.id !== 'react').map((a) => {
                                    const icon = {'reply':'↶','edit':'✎','forward':'➜','delete':'♲','report':'⚑','album-select':'☑','album-download':'↓'}[a.id] || '•';
                                    const label = a.label.replace(/^[^А-Яа-яA-Za-z]+/u,'');
                                    return <button type="button" key={a.id} onClick={() => handler(a.id)}
                                        className={`mrr-v2-telegram-action ${a.danger ? 'is-danger' : ''} ${a.id === 'album-select' ? 'is-divider' : ''}`}>
                                        <span className="mrr-v2-telegram-action-icon" aria-hidden="true">{a.id === 'copy' ? (
                                            <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>
                                        ) : a.id === 'pin' ? (
                                            <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 5 5-3.5 1.5v4L20 16l-4 4-3-3H9L3 21l4-6v-4l-3-3 4-4 2.5 2.5h4L16 3Z"/></svg>
                                        ) : icon}</span>
                                        <span>{label}</span>
                                    </button>;
                                })}
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
                        <div className="fixed inset-0 z-[70] mrr-v2-chat-menu-scrim" onClick={() => setChatMenu(null)} />
                        <div className={`card p-1 w-52 animate-pop ${isMessengerV2 ? 'mrr-v2-chat-menu' : ''}`} style={isMessengerV2 && window.innerWidth < 768 ? undefined : style}>
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
                    messengerOptimized={isMessengerV2}
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
        </>
    );
}