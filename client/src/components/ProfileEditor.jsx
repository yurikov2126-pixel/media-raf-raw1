import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, uploadBlob } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
import { pushModal } from '../lib/modalStack.js';
import Avatar from './Avatar.jsx';
import ImageCropper from './ImageCropper.jsx';
import ChangePasswordModal from './ChangePasswordModal.jsx';

const DIRECTIONS = [
    { v: 'photo', l: '📸 Фото' },
    { v: 'video', l: '🎥 Видео' },
    { v: 'radio', l: '📻 Радио' },
    { v: 'sound', l: '🎚️ Звук' },
];

function phoneTail(phone) {
    const d = String(phone || '').replace(/\D/g, '');
    if (d.length === 11) return d.slice(1);
    if (d.length === 10) return d;
    return '';
}

export default function ProfileEditor({ open, onClose, onSaved }) {
    const { user, token, setUser } = useAuth();
    const [form, setForm] = useState(() => ({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phoneTail: phoneTail(user.phone),
        bio: user.bio || '',
        direction: user.direction || '',
        birthDate: user.birthDate ? user.birthDate.slice(0, 10) : '',
        group: user.group || '',
        city: user.city || '',
        skills: (() => {
            try {
                return JSON.parse(user.skills || '[]').join(', ');
            } catch {
                return '';
            }
        })(),
        socials: (() => {
            try {
                return JSON.parse(user.socials || '{}');
            } catch {
                return {};
            }
        })(),
        avatar: user.avatar || '',
        cover: user.cover || '',
    }));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [uploading, setUploading] = useState({ avatar: false, cover: false });
    const [cropping, setCropping] = useState(null);
    const [passwordOpen, setPasswordOpen] = useState(false);

    const avatarRef = useRef(null);
    const coverRef = useRef(null);

    /* Регистрируем в стеке модалок */
    useEffect(() => {
        if (!open) return;
        const release = pushModal();
        return release;
    }, [open]);

    /* Блокируем скролл body, пока модалка открыта */
    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    /* Закрытие по Escape */
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === 'Escape' && !saving) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, saving, onClose]);

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
    const setPhone = (e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
        setForm((f) => ({ ...f, phoneTail: digits }));
    };

    const pickFile = (which) => (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setError('Выберите изображение');
            return;
        }
        setError('');
        setCropping({ file, kind: which });
    };

    const handleCropped = async (blob) => {
        const kind = cropping.kind;
        setCropping(null);
        try {
            setUploading((u) => ({ ...u, [kind]: true }));
            const res = await uploadBlob(blob, `${kind}-${Date.now()}.jpg`, token);
            setForm((f) => ({ ...f, [kind]: res.url }));
        } catch (e) {
            setError(e.message);
        } finally {
            setUploading((u) => ({ ...u, [kind]: false }));
        }
    };

    const save = async () => {
        setError('');
        if (!form.firstName.trim() || !form.lastName.trim()) {
            setError('Имя и фамилия обязательны');
            return;
        }
        if (form.phoneTail.length !== 10) {
            setError('Введите 10 цифр номера телефона');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                phone: `+7${form.phoneTail}`,
                bio: form.bio,
                direction: form.direction || null,
                birthDate: form.birthDate || null,
                group: form.group || null,
                city: form.city || null,
                skills: form.skills
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                socials: form.socials,
                avatar: form.avatar || null,
                cover: form.cover || null,
            };
            const updated = await api('/users/me', { method: 'PATCH', token, body: payload });
            setUser({ ...user, ...updated });
            onSaved?.(updated);
            onClose();
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    const modal = createPortal(
        <div
            className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm grid place-items-center"
            style={{
                /* Без touch-action: none — клики должны работать на всех
                   устройствах. Свайп-навигацию отключаем на уровне Layout. */
                overscrollBehavior: 'contain',
                overflow: 'hidden',
                paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)',
                paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
                paddingLeft: 'max(env(safe-area-inset-left, 0px), 8px)',
                paddingRight: 'max(env(safe-area-inset-right, 0px), 8px)',
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget && !saving) onClose();
            }}
        >
            <div
                className="
                    flex flex-col w-full h-full
                    md:w-auto md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-3xl md:border
                    bg-ink-900 md:bg-ink-800/80 border-white/10 md:backdrop-blur-xl
                    md:shadow-2xl md:shadow-black/50
                    min-w-0 max-w-full overflow-hidden
                "
                onClick={(e) => e.stopPropagation()}
            >
                {/* ─── Шапка ─── */}
                <div className="shrink-0 flex items-center justify-between gap-3 px-4 md:px-6 py-3 md:py-4 border-b border-white/5">
                    <h2 className="text-lg md:text-2xl font-bold truncate pr-2">
                        Редактирование профиля
                    </h2>
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="w-10 h-10 shrink-0 grid place-items-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition text-xl disabled:opacity-40"
                        aria-label="Закрыть"
                    >
                        ✕
                    </button>
                </div>

                {/* ─── Скроллируемая часть ─── */}
                <div className="flex-1 overflow-y-auto overscroll-contain px-4 md:px-6 py-4 md:py-6 space-y-5">
                    {/* Обложка */}
                    <div>
                        <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">
                            Обложка
                        </label>
                        <div className="relative h-32 md:h-40 rounded-2xl overflow-hidden bg-ink-700">
                            {form.cover ? (
                                <img src={form.cover} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div
                                    className="w-full h-full"
                                    style={{ background: 'var(--brand-gradient)' }}
                                />
                            )}
                            <button
                                type="button"
                                onClick={() => coverRef.current?.click()}
                                className="absolute bottom-2 right-2 btn-ghost !py-2 !px-3 text-xs"
                                disabled={uploading.cover}
                            >
                                {uploading.cover ? 'Загрузка…' : '📷 Сменить обложку'}
                            </button>
                            <input
                                ref={coverRef}
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={pickFile('cover')}
                            />
                        </div>
                    </div>

                    {/* Аватар */}
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="rounded-full ring-4 ring-ink-700 shrink-0">
                            <Avatar user={{ ...user, avatar: form.avatar }} size={88} />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => avatarRef.current?.click()}
                                className="btn-ghost !py-2 !px-3 text-sm"
                                disabled={uploading.avatar}
                            >
                                {uploading.avatar ? 'Загрузка…' : '📷 Сменить аватар'}
                            </button>
                            <input
                                ref={avatarRef}
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={pickFile('avatar')}
                            />
                            {form.avatar && (
                                <button
                                    type="button"
                                    onClick={() => setForm((f) => ({ ...f, avatar: '' }))}
                                    className="text-xs text-white/40 hover:text-pink"
                                >
                                    Убрать
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Поля */}
                    <div className="grid md:grid-cols-2 gap-3 min-w-0">
                        <div className="min-w-0">
                            <label className="text-xs text-white/40 uppercase mb-1 block">Имя *</label>
                            <input className="input" value={form.firstName} onChange={set('firstName')} />
                        </div>
                        <div className="min-w-0">
                            <label className="text-xs text-white/40 uppercase mb-1 block">Фамилия *</label>
                            <input className="input" value={form.lastName} onChange={set('lastName')} />
                        </div>

                        <div className="md:col-span-2 min-w-0">
                            <label className="text-xs text-white/40 uppercase mb-1 block">Телефон *</label>
                            <div className="flex">
                                <span className="input !rounded-r-none !w-14 grid place-items-center text-white/60 shrink-0">
                                    +7
                                </span>
                                <input
                                    className="input !rounded-l-none flex-1 min-w-0"
                                    inputMode="tel"
                                    placeholder="999 123-45-67"
                                    value={form.phoneTail}
                                    onChange={setPhone}
                                />
                            </div>
                        </div>

                        <div className="min-w-0">
                            <label className="text-xs text-white/40 uppercase mb-1 block">
                                Дата рождения
                            </label>
                            <input
                                type="date"
                                className="input"
                                value={form.birthDate}
                                onChange={set('birthDate')}
                            />
                        </div>

                        <div className="min-w-0">
                            <label className="text-xs text-white/40 uppercase mb-1 block">
                                Направление
                            </label>
                            <select className="input" value={form.direction} onChange={set('direction')}>
                                <option value="">— не выбрано —</option>
                                {DIRECTIONS.map((d) => (
                                    <option key={d.v} value={d.v}>
                                        {d.l}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="min-w-0">
                            <label className="text-xs text-white/40 uppercase mb-1 block">Группа</label>
                            <input
                                className="input"
                                placeholder="ИУ7-41Б"
                                value={form.group}
                                onChange={set('group')}
                            />
                        </div>

                        <div className="min-w-0">
                            <label className="text-xs text-white/40 uppercase mb-1 block">Город</label>
                            <input
                                className="input"
                                placeholder="Москва"
                                value={form.city}
                                onChange={set('city')}
                            />
                        </div>

                        <div className="md:col-span-2 min-w-0">
                            <label className="text-xs text-white/40 uppercase mb-1 block">О себе</label>
                            <textarea
                                rows={3}
                                className="input resize-none"
                                value={form.bio}
                                onChange={set('bio')}
                            />
                        </div>

                        <div className="md:col-span-2 min-w-0">
                            <label className="text-xs text-white/40 uppercase mb-1 block">
                                Навыки (через запятую)
                            </label>
                            <input
                                className="input"
                                placeholder="портрет, репортаж, Lightroom"
                                value={form.skills}
                                onChange={set('skills')}
                            />
                        </div>

                        <div className="min-w-0">
                            <label className="text-xs text-white/40 uppercase mb-1 block">Telegram</label>
                            <input
                                className="input"
                                placeholder="@username"
                                value={form.socials.tg || ''}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, socials: { ...f.socials, tg: e.target.value } }))
                                }
                            />
                        </div>
                        <div className="min-w-0">
                            <label className="text-xs text-white/40 uppercase mb-1 block">VK</label>
                            <input
                                className="input"
                                placeholder="vk.com/…"
                                value={form.socials.vk || ''}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, socials: { ...f.socials, vk: e.target.value } }))
                                }
                            />
                        </div>
                    </div>

                    {/* Безопасность */}
                    <div className="pt-5 border-t border-white/10">
                        <div className="text-xs text-white/40 uppercase tracking-wider mb-2">
                            Безопасность
                        </div>
                        <button
                            type="button"
                            onClick={() => setPasswordOpen(true)}
                            className="btn-ghost w-full"
                        >
                            🔑 Сменить пароль
                        </button>
                    </div>

                    {error && <p className="text-pink text-sm">{error}</p>}
                </div>

                {/* ─── Футер с кнопками ─── */}
                <div className="shrink-0 flex gap-3 px-4 md:px-6 py-3 md:py-4 border-t border-white/5 bg-ink-900/95 md:bg-ink-800/40">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="btn-ghost flex-1 md:flex-none md:min-w-[120px]"
                    >
                        Отмена
                    </button>
                    <button
                        onClick={save}
                        disabled={saving}
                        className="btn-primary flex-1 md:flex-none md:min-w-[140px]"
                    >
                        {saving ? 'Сохранение…' : 'Сохранить'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );

    return (
        <>
            {modal}

            {cropping?.kind === 'avatar' && (
                <ImageCropper
                    file={cropping.file}
                    aspect={1}
                    outputWidth={512}
                    outputHeight={512}
                    title="Обрезка аватара"
                    onCancel={() => setCropping(null)}
                    onDone={handleCropped}
                />
            )}
            {cropping?.kind === 'cover' && (
                <ImageCropper
                    file={cropping.file}
                    aspect={3}
                    outputWidth={1500}
                    outputHeight={500}
                    title="Обрезка обложки"
                    onCancel={() => setCropping(null)}
                    onDone={handleCropped}
                />
            )}

            {passwordOpen && (
                <ChangePasswordModal
                    mode="self"
                    onClose={() => setPasswordOpen(false)}
                />
            )}
        </>
    );
}