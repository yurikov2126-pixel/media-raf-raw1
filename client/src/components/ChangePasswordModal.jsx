import { useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

function generatePassword(len = 12) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let out = '';
    for (let i = 0; i < len; i++) {
        out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
}

/**
 * Универсальная модалка смены/сброса пароля.
 * props:
 *   mode     — 'self' | 'reset'
 *   userId   — id пользователя (только для mode='reset')
 *   userName — имя (для mode='reset', для сообщения)
 *   onClose  — закрыть модалку (вызывается и по «Отмена», и после успеха)
 *   onDone   — опционально: вызывается после успеха перед закрытием
 */
export default function ChangePasswordModal({
                                                mode = 'self',
                                                userId,
                                                userName,
                                                onClose,
                                                onDone,
                                            }) {
    const { token } = useAuth();
    const isSelf = mode === 'self';

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const strength = (() => {
        if (!newPassword) return null;
        if (newPassword.length < 6) return { l: 'Короткий', c: 'text-pink' };
        if (newPassword.length < 10) return { l: 'Средний', c: 'text-orange-300' };
        return { l: 'Хороший', c: 'text-lime' };
    })();

    const submit = async (e) => {
        e?.preventDefault();
        setError('');

        if (isSelf && !currentPassword) {
            setError('Введите текущий пароль');
            return;
        }
        if (!newPassword) {
            setError('Введите новый пароль');
            return;
        }
        if (newPassword.length < 6) {
            setError('Пароль не короче 6 символов');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Пароли не совпадают');
            return;
        }
        if (isSelf && currentPassword === newPassword) {
            setError('Новый пароль должен отличаться от текущего');
            return;
        }

        setBusy(true);
        try {
            if (isSelf) {
                await api('/users/me/password', {
                    method: 'PATCH',
                    token,
                    body: { currentPassword, newPassword },
                });
            } else {
                await api(`/admin/users/${userId}/password`, {
                    method: 'PATCH',
                    token,
                    body: { newPassword },
                });
            }
            setSuccess(true);
            onDone?.();
            setTimeout(() => {
                onClose?.();
            }, 1300);
        } catch (e) {
            setError(e.message || 'Ошибка');
            setBusy(false);
        }
    };

    const inputType = showPasswords ? 'text' : 'password';

    return (
        <div
            className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
            onClick={onClose}
        >
            <form
                onSubmit={submit}
                className="card max-w-md w-full p-5 md:p-6 my-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl md:text-2xl font-bold">
                        {isSelf ? '🔑 Смена пароля' : '🔑 Сброс пароля'}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-white/40 hover:text-white text-xl"
                        aria-label="Закрыть"
                    >
                        ✕
                    </button>
                </div>

                {!isSelf && userName && (
                    <div className="mb-4 p-3 rounded-2xl bg-violet/10 border border-violet/20 text-sm">
                        Сброс пароля для <b>{userName}</b>. После сброса пользователь сможет войти
                        с новым паролем.
                    </div>
                )}

                {success ? (
                    <div className="py-8 text-center">
                        <div className="text-5xl mb-3">✅</div>
                        <div className="text-lg font-bold text-lime">Пароль обновлён</div>
                        <div className="text-sm text-white/50 mt-2">
                            {isSelf
                                ? 'Используйте новый пароль при следующем входе'
                                : 'Сообщите пароль пользователю'}
                        </div>
                    </div>
                ) : (
                    <>
                        {isSelf && (
                            <div className="mb-3">
                                <label className="text-xs text-white/40 uppercase block mb-1">
                                    Текущий пароль
                                </label>
                                <input
                                    type={inputType}
                                    className="input"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="••••••"
                                    autoComplete="current-password"
                                    autoFocus
                                />
                            </div>
                        )}

                        <div className="mb-3">
                            <label className="text-xs text-white/40 uppercase block mb-1">
                                Новый пароль
                            </label>
                            <input
                                type={inputType}
                                className="input"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Минимум 6 символов"
                                autoComplete="new-password"
                                autoFocus={!isSelf}
                            />
                            {strength && (
                                <div className={`text-xs mt-1 ${strength.c}`}>
                                    Надёжность: {strength.l}
                                </div>
                            )}
                        </div>

                        <div className="mb-3">
                            <label className="text-xs text-white/40 uppercase block mb-1">
                                Повторите новый пароль
                            </label>
                            <input
                                type={inputType}
                                className="input"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Ещё раз"
                                autoComplete="new-password"
                            />
                        </div>

                        <div className="flex items-center justify-between mb-4">
                            <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showPasswords}
                                    onChange={(e) => setShowPasswords(e.target.checked)}
                                />
                                Показать пароли
                            </label>

                            {!isSelf && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const p = generatePassword();
                                        setNewPassword(p);
                                        setConfirmPassword(p);
                                        setShowPasswords(true);
                                    }}
                                    className="text-xs text-violet-soft hover:text-white"
                                >
                                    🎲 Сгенерировать
                                </button>
                            )}
                        </div>

                        {error && (
                            <p className="text-pink text-sm mb-3 p-2 rounded-xl bg-pink/10">{error}</p>
                        )}

                        <div className="flex gap-3 justify-end">
                            <button type="button" onClick={onClose} className="btn-ghost">
                                Отмена
                            </button>
                            <button type="submit" disabled={busy} className="btn-primary">
                                {busy ? 'Сохранение…' : isSelf ? 'Сменить пароль' : 'Сбросить пароль'}
                            </button>
                        </div>
                    </>
                )}
            </form>
        </div>
    );
}