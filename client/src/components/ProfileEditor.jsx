import { useRef, useState } from 'react';
import { api, uploadBlob } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';
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

    return (
        <>
            <div
                className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm overflow-y-auto p-3 md:p-6"
                onClick={onClose}
            >
                <div
                    className="card max-w-2xl mx-auto my-6 p-5 md:p-6"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-2xl font-bold">Редактирование профиля</h2>
                        <button
                            onClick={onClose}
                            className="text-white/40 hover:text-white text-xl"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Обложка */}
                    <div className="mb-5">
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
                                hidden
                                onChange={pickFile('cover')}
                            />
                        </div>
                    </div>

                    {/* Аватар */}
                    <div className="mb-5 flex items-center gap-4">
                        <div className="rounded-full ring-4 ring-ink-700">
                            <Avatar user={{ ...user, avatar: form.avatar }} size={88} />
                        </div>
                        <div>
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
                                hidden
                                onChange={pickFile('avatar')}
                            />
                            {form.avatar && (
                                <button
                                    type="button"
                                    onClick={() => setForm((f) => ({ ...f, avatar: '' }))}
                                    className="ml-2 text-xs text-white/40 hover:text-pink"
                                >
                                    Убрать
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Поля */}
                    <div className="grid md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-white/40 uppercase mb-1 block">Имя *</label>
                            <input
                                className="input"
                                value={form.firstName}
                                onChange={set('firstName')}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-white/40 uppercase mb-1 block">Фамилия *</label>
                            <input
                                className="input"
                                value={form.lastName}
                                onChange={set('lastName')}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-xs text-white/40 uppercase mb-1 block">Телефон *</label>
                            <div className="flex">
                <span className="input !rounded-r-none !w-14 grid place-items-center text-white/60">
                  +7
                </span>
                                <input
                                    className="input !rounded-l-none flex-1"
                                    inputMode="tel"
                                    placeholder="999 123-45-67"
                                    value={form.phoneTail}
                                    onChange={setPhone}
                                />
                            </div>
                        </div>

                        <div>
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

                        <div>
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

                        <div>
                            <label className="text-xs text-white/40 uppercase mb-1 block">Группа</label>
                            <input
                                className="input"
                                placeholder="ИУ7-41Б"
                                value={form.group}
                                onChange={set('group')}
                            />
                        </div>

                        <div>
                            <label className="text-xs text-white/40 uppercase mb-1 block">Город</label>
                            <input
                                className="input"
                                placeholder="Москва"
                                value={form.city}
                                onChange={set('city')}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-xs text-white/40 uppercase mb-1 block">О себе</label>
                            <textarea
                                rows={3}
                                className="input resize-none"
                                value={form.bio}
                                onChange={set('bio')}
                            />
                        </div>

                        <div className="md:col-span-2">
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

                        <div>
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
                        <div>
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
                    <div className="mt-6 pt-5 border-t border-white/10">
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

                    {error && <p className="text-pink text-sm mt-4">{error}</p>}

                    <div className="flex gap-3 justify-end mt-6">
                        <button onClick={onClose} className="btn-ghost">
                            Отмена
                        </button>
                        <button onClick={save} disabled={saving} className="btn-primary">
                            {saving ? 'Сохранение…' : 'Сохранить'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Кропперы */}
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

            {/* Модалка смены пароля — рендерится ТОЛЬКО когда open */}
            {passwordOpen && (
                <ChangePasswordModal
                    mode="self"
                    onClose={() => setPasswordOpen(false)}
                />
            )}
        </>
    );
}