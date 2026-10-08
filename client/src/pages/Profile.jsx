import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import { useGamification } from '../store/gamification.jsx';
import Avatar from '../components/Avatar.jsx';
import ProfileEditor from '../components/ProfileEditor.jsx';
import PostComposer from '../components/PostComposer.jsx';
import PostCard from '../components/PostCard.jsx';
import ReportButton from '../components/ReportButton.jsx';
import LevelBadge from '../components/LevelBadge.jsx';
import XpProgressBar from '../components/XpProgressBar.jsx';
import AchievementCard from '../components/AchievementCard.jsx';
import QuestCard from '../components/QuestCard.jsx';
import usePageMeta from '../hooks/usePageMeta.js';
import ProfilePortfolioStrip from '../components/ProfilePortfolioStrip.jsx';

const DIR = { photo: '📸 Фото', video: '🎥 Видео', radio: '📻 Радио', sound: '🎚️ Звук' };

const SOCIAL_META = {
    tg:   { label: 'Telegram',  icon: 'tg',  base: 'https://t.me/' },
    vk:   { label: 'VK',        icon: '🅥',  base: 'https://vk.com/' },
    inst: { label: 'Instagram', icon: '📷',  base: 'https://instagram.com/' },
};

function TelegramIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="currentColor"
            aria-hidden="true"
            style={{ display: 'block' }}
        >
            <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
        </svg>
    );
}

function buildSocialUrl(key, raw) {
    const val = String(raw ?? '').trim();
    if (!val) return null;
    if (/^https?:\/\//i.test(val)) return val;
    const meta = SOCIAL_META[key];
    if (!meta) return null;
    const handle = val.replace(/^@/, '').replace(/^\/+/, '');
    if (!handle) return null;
    return meta.base + handle;
}

function SocialLink({ network, value }) {
    const meta = SOCIAL_META[network];
    if (!meta) return null;
    const url = buildSocialUrl(network, value);
    if (!url) return null;
    const handle = String(value).replace(/^@/, '').replace(/^https?:\/\//i, '');

    const iconNode = meta.icon === 'tg'
        ? (
            <span
                className="inline-grid place-items-center w-5 h-5 rounded-full shrink-0"
                style={{ background: 'linear-gradient(135deg, #29A9EB 0%, #1E96D1 100%)', color: '#fff' }}
            >
                <TelegramIcon />
            </span>
        )
        : <span aria-hidden="true">{meta.icon}</span>;

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="chip bg-white/5 hover:bg-white/10 transition !normal-case !tracking-normal !font-medium text-sm"
            title={`${meta.label}: ${url}`}
        >
            {iconNode}
            <span className="truncate max-w-[180px]">{handle}</span>
        </a>
    );
}

export default function Profile() {
    const { username } = useParams();
    const location = useLocation();
    const { user: me, token } = useAuth();
    const gamifStore = useGamification();

    const [profile, setProfile] = useState(null);
    const [tab, setTab] = useState('posts');
    const [editorOpen, setEditorOpen] = useState(false);
    const [gamif, setGamif] = useState(null);

    const isMe = me.username === username;

    const load = () =>
        api(`/users/${username}`, { token })
            .then(setProfile)
            .catch(() => setProfile(null));

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [username, token]);

    useEffect(() => {
        if (!isMe || !location.state?.compose) return;
        setTab('posts');
        setTimeout(() => document.querySelector('.profile-v2 textarea')?.focus(), 50);
        window.history.replaceState({}, document.title, window.location.href);
    }, [isMe, location.state?.compose]);

    useEffect(() => {
        if (!token || !profile) return;
        api(`/gamification/user/${username}`, { token })
            .then(setGamif)
            .catch(() => setGamif(null));
    }, [username, token, profile]);

    usePageMeta({
        title: profile ? `${profile.fullName} (@${profile.username})` : 'Профиль',
        description: profile?.bio || 'Профиль студента медиацентра MEDIA·RAF·RAW',
        image: profile?.avatar,
        type: 'profile',
    });

    const openChat = async () => {
        const chat = await api('/chats/direct', {
            method: 'POST',
            token,
            body: { userId: profile.id },
        });
        window.location.href = `/app/chats/${chat.id}`;
    };

    if (!profile) {
        return <div className="p-10 text-center text-white/40">Загрузка…</div>;
    }

    const skills = (() => {
        try { return JSON.parse(profile.skills || '[]'); } catch { return []; }
    })();
    const socials = (() => {
        try { return JSON.parse(profile.socials || '{}'); } catch { return {}; }
    })();

    const hasSocials = socials.tg || socials.vk || socials.inst;

    const showQuestsTab = isMe && gamifStore.enabled && gamifStore.questsEnabled;

    return (
        <div className="ui-profile-page profile-v2">
            <div className="relative h-44 md:h-60 overflow-hidden rounded-b-3xl">
                {profile.cover ? (
                    <img
                        src={profile.cover}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                ) : (
                    <div
                        className="absolute inset-0"
                        style={{ background: 'var(--brand-gradient)' }}
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink-900/80 via-transparent to-transparent" />
            </div>

            <div className="px-5 md:px-8 pb-10 -mt-14 relative z-10">
                {/* ─── Ряд: аватар + кнопки ───
                    Имя вынесено из этого ряда в отдельный блок ниже,
                    чтобы при длинных именах и наличии значка уровня
                    текст не заезжал на обложку. */}
                <div className="flex items-end gap-4 flex-wrap">
                    <div className="rounded-full ring-4 ring-ink-900 bg-ink-900 shrink-0">
                        <Avatar user={profile} size={112} />
                    </div>
                    <div className="ml-auto flex gap-2 pb-2">
                        {isMe ? (
                            <button
                                onClick={() => setEditorOpen(true)}
                                className="btn-ghost"
                            >
                                ✏️ Редактировать
                            </button>
                        ) : (
                            <>
                                <button onClick={openChat} className="btn-primary">
                                    💬 Написать
                                </button>
                                <ReportButton
                                    targetType="user"
                                    targetId={profile.id}
                                    iconOnly
                                    className="btn-ghost !px-3"
                                />
                            </>
                        )}
                    </div>
                </div>

                {/* ─── Имя + уровень ниже обложки ─── */}
                <div className="mt-4">
                    <div className="text-2xl md:text-3xl font-bold break-words leading-tight">
                        {profile.fullName}
                    </div>
                    {gamif?.stats && gamifStore.enabled && (
                        <div className="mt-2">
                            <LevelBadge level={gamif.stats.level} size="md" />
                        </div>
                    )}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                    {profile.direction && (
                        <span className="chip bg-violet/20 text-violet-soft">
                            {DIR[profile.direction] || profile.direction}
                        </span>
                    )}
                    {profile.group && <span className="chip bg-white/5">🎓 {profile.group}</span>}
                    {profile.city && <span className="chip bg-white/5">📍 {profile.city}</span>}
                    {profile.birthDate && (
                        <span className="chip bg-white/5">
                            🎂 {new Date(profile.birthDate).toLocaleDateString('ru-RU')}
                        </span>
                    )}
                    {profile.role === 'ADMIN' && (
                        <span className="chip bg-pink/20 text-pink-soft">ADMIN</span>
                    )}
                    {profile.role === 'MENTOR' && (
                        <span className="chip bg-cyan/20 text-cyan-soft">MENTOR</span>
                    )}
                </div>

                {profile.bio && (
                    <p className="mt-4 text-white/70 whitespace-pre-wrap">{profile.bio}</p>
                )}

                {skills.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {skills.map((s) => (
                            <span key={s} className="chip bg-white/5">
                                {s}
                            </span>
                        ))}
                    </div>
                )}

                {hasSocials && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {socials.tg && <SocialLink network="tg" value={socials.tg} />}
                        {socials.vk && <SocialLink network="vk" value={socials.vk} />}
                        {socials.inst && <SocialLink network="inst" value={socials.inst} />}
                    </div>
                )}

                {/* ─── XP-карточка ─── */}
                {gamif?.stats && gamifStore.enabled && (
                    <div className="mt-5 card p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-3">
                                <div className="text-3xl">⚡</div>
                                <div>
                                    <div className="font-bold text-lg">{gamif.stats.xp} XP</div>
                                    <div className="text-xs text-white/50">
                                        Уровень {gamif.stats.level}
                                        {gamif.stats.streakCurrent > 0 && (
                                            <>
                                                {' · '}
                                                🔥 {gamif.stats.streakCurrent}
                                                {gamif.stats.streakBest > gamif.stats.streakCurrent
                                                    ? ` (рекорд ${gamif.stats.streakBest})`
                                                    : ''}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {gamifStore.leaderboardEnabled !== false && (
                                <Link
                                    to="/app/leaderboard"
                                    className="chip bg-white/5 hover:bg-white/10 text-xs"
                                >
                                    🏆 Рейтинг
                                </Link>
                            )}
                        </div>
                        <XpProgressBar progress={gamif.progress} />
                    </div>
                )}

                <ProfilePortfolioStrip profile={profile} gamif={gamif} gamifEnabled={gamifStore.enabled} />

                {/* ─── Табы ─── */}
                <div className="mt-6 border-b border-white/10 flex gap-4 overflow-x-auto no-scrollbar">
                    {[
                        ['posts', 'Публикации'],
                        ['courses', 'Курсы'],
                        ['certificates', 'Сертификаты'],
                        ...(showQuestsTab ? [['quests', '⚔️ Квесты']] : []),
                        ...(gamif?.stats && gamifStore.enabled ? [['achievements', '🏆 Достижения']] : []),
                    ].map(([k, l]) => (
                        <button
                            key={k}
                            onClick={() => setTab(k)}
                            className={`pb-3 -mb-px border-b-2 whitespace-nowrap ${
                                tab === k
                                    ? 'border-violet text-white'
                                    : 'border-transparent text-white/40'
                            }`}
                        >
                            {l}
                        </button>
                    ))}
                </div>

                {tab === 'posts' && (
                    <div className="py-6 space-y-4">
                        {isMe && <PostComposer onPublished={() => { load(); gamifStore.reload?.(); gamifStore.reloadQuests?.(); }} />}
                        {profile.posts?.map((p) => (
                            <PostCard
                                key={p.id}
                                post={p}
                                author={profile}
                                onChanged={(u) =>
                                    setProfile((pr) => ({
                                        ...pr,
                                        posts: pr.posts.map((x) => (x.id === u.id ? u : x)),
                                    }))
                                }
                                onDeleted={(id) =>
                                    setProfile((pr) => ({
                                        ...pr,
                                        posts: pr.posts.filter((x) => x.id !== id),
                                    }))
                                }
                            />
                        ))}
                        {(!profile.posts || profile.posts.length === 0) && (
                            <p className="text-center text-white/30 py-8">
                                Пока нет публикаций
                            </p>
                        )}
                    </div>
                )}

                {tab === 'courses' && (
                    <div className="py-6 grid gap-3">
                        {profile.enrollments?.length ? (
                            profile.enrollments.map((e) => (
                                <div
                                    key={e.id}
                                    className="card p-4 flex items-center gap-3"
                                >
                                    <div
                                        className="w-12 h-12 grid place-items-center rounded-xl"
                                        style={{ background: 'var(--brand-gradient)' }}
                                    >
                                        🎓
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold">{e.course.title}</div>
                                        <div className="text-xs text-white/40">
                                            Прогресс: {e.progress}%
                                        </div>
                                    </div>
                                    {e.completed && (
                                        <span className="chip bg-lime/20 text-lime-soft">✓</span>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-white/30 py-8">Нет активных курсов</p>
                        )}
                    </div>
                )}

                {tab === 'certificates' && (
                    <div className="py-6 grid gap-3">
                        {profile.certificates?.length ? (
                            profile.certificates.map((c) => (
                                <Link
                                    key={c.id}
                                    to={`/app/certificates/${c.id}`}
                                    className="card p-4 flex items-center gap-3 hover:-translate-y-0.5 transition"
                                >
                                    <div
                                        className="w-12 h-12 grid place-items-center rounded-xl text-2xl"
                                        style={{ background: 'var(--brand-gradient)' }}
                                    >
                                        🏆
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold">{c.title}</div>
                                        <div className="text-xs text-white/40">
                                            {c.course.title} ·{' '}
                                            {new Date(c.issuedAt).toLocaleDateString('ru-RU')}
                                        </div>
                                        <div className="text-[10px] text-white/30 mt-0.5">
                                            № {c.serial}
                                        </div>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <p className="text-center text-white/30 py-8">
                                Сертификатов пока нет
                            </p>
                        )}
                    </div>
                )}

                {tab === 'quests' && showQuestsTab && (
                    <div className="py-6">
                        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                            <div>
                                <div className="text-lg font-bold">Ежедневные квесты</div>
                                <div className="text-sm text-white/50">
                                    Обновляются каждый день
                                </div>
                            </div>
                            <div className="chip bg-violet/20 text-violet-soft text-xs">
                                {gamifStore.quests.filter((q) => q.completed).length} / {gamifStore.quests.length} выполнено
                            </div>
                        </div>
                        {gamifStore.quests.length === 0 && (
                            <div className="card p-6 text-center text-white/40">
                                Загрузка квестов…
                            </div>
                        )}
                        {gamifStore.quests.length > 0 && (
                            <div className="grid sm:grid-cols-2 gap-3">
                                {gamifStore.quests.map((q) => (
                                    <QuestCard key={q.id} quest={q} typeMeta={gamifStore.questTypeMeta} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {tab === 'achievements' && gamif && (
                    <div className="py-6">
                        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                            <div>
                                <div className="text-lg font-bold">Достижения</div>
                                <div className="text-sm text-white/50">
                                    Открыто {gamif.achievements.filter((a) => a.unlocked).length} из {gamif.achievements.length}
                                </div>
                            </div>
                            {gamif.stats.streakCurrent > 0 && (
                                <div className="chip bg-orange-500/20 text-orange-300">
                                    🔥 Серия {gamif.stats.streakCurrent} дн.
                                </div>
                            )}
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                            {gamif.achievements.map((a) => (
                                <AchievementCard key={a.id} achievement={a} />
                            ))}
                        </div>
                    </div>
                )}

                {tab === 'achievements' && !gamif && (
                    <div className="py-10 text-center text-white/40">Загрузка…</div>
                )}
            </div>

            {isMe && (
                <ProfileEditor
                    open={editorOpen}
                    onClose={() => setEditorOpen(false)}
                    onSaved={(u) => setProfile((p) => ({ ...p, ...u }))}
                />
            )}

        </div>
    );
}