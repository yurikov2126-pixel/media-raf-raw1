import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, uploadBlob } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import Avatar from '../components/Avatar.jsx';
import ProfileEditor from '../components/ProfileEditor.jsx';
import ImageCropper from '../components/ImageCropper.jsx';
import PostCard from '../components/PostCard.jsx';

const DIR = { photo: '📸 Фото', video: '🎥 Видео', radio: '📻 Радио', sound: '🎚️ Звук' };

/* База для соцсетей. Значение может быть:
   - username:  "@user"  или  "user"
   - полный URL: "https://t.me/user"
   В первом случае подставляем базу, во втором — используем как есть. */
const SOCIAL_META = {
    tg:   { label: 'Telegram',  icon: '✈️', base: 'https://t.me/' },
    vk:   { label: 'VK',        icon: '🅥', base: 'https://vk.com/' },
    inst: { label: 'Instagram', icon: '📷', base: 'https://instagram.com/' },
};

function buildSocialUrl(key, raw) {
    const val = String(raw ?? '').trim();
    if (!val) return null;

    // Уже полный URL — оставляем как есть
    if (/^https?:\/\//i.test(val)) return val;

    const meta = SOCIAL_META[key];
    if (!meta) return null;

    // Убираем @ и ведущие слэши
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

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="chip bg-white/5 hover:bg-white/10 transition !normal-case !tracking-normal !font-medium text-sm"
            title={url}
        >
            <span aria-hidden="true">{meta.icon}</span>
            <span className="truncate max-w-[180px]">{handle}</span>
        </a>
    );
}

export default function Profile() {
    const { username } = useParams();
    const { user: me, token } = useAuth();
    const [profile, setProfile] = useState(null);
    const [tab, setTab] = useState('posts');
    const [postText, setPostText] = useState('');
    const [postImage, setPostImage] = useState('');
    const [cropping, setCropping] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [editorOpen, setEditorOpen] = useState(false);
    const fileRef = useRef(null);

    const isMe = me.username === username;

    const load = () => api(`/users/${username}`, { token }).then(setProfile).catch(() => setProfile(null));
    useEffect(() => { load(); }, [username, token]);

    const pickPostImage = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !file.type.startsWith('image/')) return;
        setCropping({ file });
    };

    const handleCropped = async (blob) => {
        setCropping(null);
        try {
            setUploadingImage(true);
            const res = await uploadBlob(blob, `post-${Date.now()}.jpg`, token);
            setPostImage(res.absoluteUrl);
        } catch (e) { alert(e.message); }
        finally { setUploadingImage(false); }
    };

    const publish = async () => {
        if (!postText.trim() && !postImage) return;
        setPublishing(true);
        try {
            await api('/posts', {
                method: 'POST', token,
                body: { content: postText, mediaUrl: postImage || null, mediaType: postImage ? 'image' : null },
            });
            setPostText('');
            setPostImage('');
            load();
        } finally { setPublishing(false); }
    };

    const openChat = async () => {
        const chat = await api('/chats/direct', { method: 'POST', token, body: { userId: profile.id } });
        window.location.href = `/app/chats/${chat.id}`;
    };

    if (!profile) return <div className="p-10 text-center text-white/40">Загрузка…</div>;

    const skills = (() => { try { return JSON.parse(profile.skills || '[]'); } catch { return []; } })();
    const socials = (() => { try { return JSON.parse(profile.socials || '{}'); } catch { return {}; } })();

    const hasSocials = socials.tg || socials.vk || socials.inst;

    return (
        <div className="max-w-3xl mx-auto">
            <div className="relative h-44 md:h-60 overflow-hidden rounded-b-3xl">
                {profile.cover
                    ? <img src={profile.cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    : <div className="absolute inset-0" style={{ background: 'var(--brand-gradient)' }} />}
                <div className="absolute inset-0 bg-gradient-to-t from-ink-900/80 via-transparent to-transparent" />
            </div>

            <div className="px-5 md:px-8 pb-10 -mt-14 relative z-10">
                <div className="flex items-end gap-4 flex-wrap">
                    <div className="rounded-full ring-4 ring-ink-900 bg-ink-900">
                        <Avatar user={profile} size={112} />
                    </div>
                    <div className="flex-1 min-w-[180px] pb-1">
                        <div className="text-2xl md:text-3xl font-bold break-words">{profile.fullName}</div>
                        <div className="text-white/50">@{profile.username}</div>
                    </div>
                    <div className="pb-1">
                        {isMe ? (
                            <button onClick={() => setEditorOpen(true)} className="btn-ghost">✏️ Редактировать</button>
                        ) : (
                            <button onClick={openChat} className="btn-primary">💬 Написать</button>
                        )}
                    </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                    {profile.direction && <span className="chip bg-violet/20 text-violet-soft">{DIR[profile.direction] || profile.direction}</span>}
                    {profile.group && <span className="chip bg-white/5">🎓 {profile.group}</span>}
                    {profile.city && <span className="chip bg-white/5">📍 {profile.city}</span>}
                    {profile.birthDate && <span className="chip bg-white/5">🎂 {new Date(profile.birthDate).toLocaleDateString('ru-RU')}</span>}
                    {profile.role === 'ADMIN' && <span className="chip bg-pink/20 text-pink-soft">ADMIN</span>}
                    {profile.role === 'MENTOR' && <span className="chip bg-cyan/20 text-cyan-soft">MENTOR</span>}
                </div>

                {profile.bio && <p className="mt-4 text-white/70 whitespace-pre-wrap">{profile.bio}</p>}

                {skills.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {skills.map((s) => <span key={s} className="chip bg-white/5">{s}</span>)}
                    </div>
                )}

                {/* Соцсети — кликабельные чипы, ведут на внешние сайты
                    в новой вкладке. Принимают и @username, и полный URL. */}
                {hasSocials && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {socials.tg   && <SocialLink network="tg"   value={socials.tg} />}
                        {socials.vk   && <SocialLink network="vk"   value={socials.vk} />}
                        {socials.inst && <SocialLink network="inst" value={socials.inst} />}
                    </div>
                )}

                <div className="mt-6 border-b border-white/10 flex gap-4">
                    {[['posts', 'Публикации'], ['courses', 'Курсы'], ['certificates', 'Сертификаты']].map(([k, l]) => (
                        <button key={k} onClick={() => setTab(k)}
                                className={`pb-3 -mb-px border-b-2 ${tab === k ? 'border-violet text-white' : 'border-transparent text-white/40'}`}>
                            {l}
                        </button>
                    ))}
                </div>

                {tab === 'posts' && (
                    <div className="py-6 space-y-4">
                        {isMe && (
                            <div className="card p-4">
                                <textarea className="input resize-none" rows={3} placeholder="Что нового?"
                                          value={postText} onChange={(e) => setPostText(e.target.value)} />
                                {postImage && (
                                    <div className="relative mt-3 rounded-2xl overflow-hidden">
                                        <img src={postImage} alt="" className="w-full max-h-72 object-cover" />
                                        <button onClick={() => setPostImage('')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white">✕</button>
                                    </div>
                                )}
                                <div className="mt-3 flex items-center justify-between">
                                    <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost !py-2 !px-3 text-sm" disabled={uploadingImage}>
                                        {uploadingImage ? 'Загрузка…' : '📷 Фото'}
                                    </button>
                                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPostImage} />
                                    <button onClick={publish} disabled={publishing || (!postText.trim() && !postImage)} className="btn-primary !py-2">
                                        {publishing ? '…' : 'Опубликовать'}
                                    </button>
                                </div>
                            </div>
                        )}
                        {profile.posts?.map((p) => (
                            <PostCard
                                key={p.id}
                                post={p}
                                author={profile}
                                onChanged={(u) => setProfile((pr) => ({ ...pr, posts: pr.posts.map((x) => x.id === u.id ? u : x) }))}
                                onDeleted={(id) => setProfile((pr) => ({ ...pr, posts: pr.posts.filter((x) => x.id !== id) }))}
                            />
                        ))}
                        {(!profile.posts || profile.posts.length === 0) && (
                            <p className="text-center text-white/30 py-8">Пока нет публикаций</p>
                        )}
                    </div>
                )}

                {tab === 'courses' && (
                    <div className="py-6 grid gap-3">
                        {profile.enrollments?.length ? profile.enrollments.map((e) => (
                            <div key={e.id} className="card p-4 flex items-center gap-3">
                                <div className="w-12 h-12 grid place-items-center rounded-xl" style={{ background: 'var(--brand-gradient)' }}>🎓</div>
                                <div className="flex-1">
                                    <div className="font-semibold">{e.course.title}</div>
                                    <div className="text-xs text-white/40">Прогресс: {e.progress}%</div>
                                </div>
                                {e.completed && <span className="chip bg-lime/20 text-lime-soft">✓</span>}
                            </div>
                        )) : <p className="text-center text-white/30 py-8">Нет активных курсов</p>}
                    </div>
                )}

                {tab === 'certificates' && (
                    <div className="py-6 grid gap-3">
                        {profile.certificates?.length ? profile.certificates.map((c) => (
                            <Link key={c.id} to={`/app/certificates/${c.id}`} className="card p-4 flex items-center gap-3 hover:-translate-y-0.5 transition">
                                <div className="w-12 h-12 grid place-items-center rounded-xl text-2xl" style={{ background: 'var(--brand-gradient)' }}>🏆</div>
                                <div className="flex-1">
                                    <div className="font-semibold">{c.title}</div>
                                    <div className="text-xs text-white/40">
                                        {c.course.title} · {new Date(c.issuedAt).toLocaleDateString('ru-RU')}
                                    </div>
                                    <div className="text-[10px] text-white/30 mt-0.5">№ {c.serial}</div>
                                </div>
                            </Link>
                        )) : <p className="text-center text-white/30 py-8">Сертификатов пока нет</p>}
                    </div>
                )}
            </div>

            {isMe && <ProfileEditor open={editorOpen} onClose={() => setEditorOpen(false)} onSaved={(u) => setProfile((p) => ({ ...p, ...u }))} />}
            {cropping && (
                <ImageCropper
                    file={cropping.file}
                    aspect={4 / 3}
                    outputWidth={1280}
                    outputHeight={960}
                    title="Обрезка изображения для поста"
                    onCancel={() => setCropping(null)}
                    onDone={handleCropped}
                />
            )}
        </div>
    );
}