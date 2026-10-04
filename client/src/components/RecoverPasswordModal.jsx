import { useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api/client.js';

/**
 * Трёхшаговая модалка восстановления пароля.
 *
 * Шаг 1 — ввод идентификатора (телефон/@ник/email).
 * Шаг 2 — ожидание кода от админа + ввод кода и нового пароля.
 * Шаг 3 — успех.
 */
export default function RecoverPasswordModal({ open, onClose }) {
    const [step, setStep] = useState(1);
    const [identifier, setIdentifier] = useState('');
    const [phoneMasked, setPhoneMasked] = useState('');
    const [fullName, setFullName] = useState('');
    const [code, setCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    if (!open) return null;

    const reset = () => {
        setStep(1);
        setIdentifier('');
        setPhoneMasked('');
        setFullName('');
        setCode('');
        setNewPassword('');
        setConfirmPassword('');
        setError('');
        setBusy(false);
    };

    const close = () => {
        if (busy) return;
        reset();
        onClose();
    };

    /* ─── Шаг 1: создание заявки ─── */
    const submitRequest = async (e) => {
        e.preventDefault();
        setError('');
        if (!identifier.trim()) {
            setError('Введите телефон, @ник или email');
            return;
        }
        setBusy(true);
        try {
            const r = await api('/auth/recover/request', {
                method: 'POST',
                body: { identifier: identifier.trim() },
            });
            setPhoneMasked(r.phoneMasked || '');
            setFullName(r.fullName || '');
            setStep(2);
        } catch (err) {
            setError(err.message || 'Не удалось отправить запрос');
        } finally {
            setBusy(false);
        }
    };

    /* ─── Шаг 2: проверка кода + новый пароль ─── */
    const submitReset = async (e) => {
        e.preventDefault();
        setError('');

        if (code.length !== 6) {
            setError('Код должен содержать 6 цифр');
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

        setBusy(true);
        try {
            await api('/auth/recover/verify', {
                method: 'POST',
                body: {
                    identifier: identifier.trim(),
                    code,
                    newPassword,
                },
            });
            setStep(3);
        } catch (err) {
            setError(err.message || 'Не удалось сменить пароль');
        } finally {
            setBusy(false);
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm grid place-items-center p-4"
            onClick={close}
        >
            <div
                className="card max-w-md w-full p-5"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Шапка */}
                <div className="flex items-center justify-between mb-4">
                    <div className="font-bold text-lg">
                        {step === 1 && '🔑 Восстановление пароля'}
                        {step === 2 && '📱 Введите код'}
                        {step === 3 && '✅ Готово'}
                    </div>
                    <button
                        onClick={close}
                        className="w-8 h-8 grid place-items-center rounded-full text-white/40 hover:text-white hover:bg-white/10"
                        aria-label="Закрыть"
                    >
                        ✕
                    </button>
                </div>

                {/* ─── Шаг 1 ─── */}
                {step === 1 && (
                    <form onSubmit={submitRequest}>
                        <p className="text-sm text-white/60 mb-4">
                            Введите данные, которые вы указали при регистрации.
                            Мы отправим запрос администратору — он свяжется
                            с вами и сообщит код для сброса.
                        </p>

                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">
                            Телефон, @ник или email
                        </label>
                        <input
                            className="input mb-4"
                            placeholder="например: +7 999 123-45-67 или @ivan"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            autoFocus
                            disabled={busy}
                        />

                        {error && (
                            <div className="text-sm text-pink bg-pink/10 rounded-xl p-3 mb-3">
                                {error}
                            </div>
                        )}

                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={close}
                                disabled={busy}
                                className="btn-ghost"
                            >
                                Отмена
                            </button>
                            <button
                                type="submit"
                                disabled={busy}
                                className="btn-primary"
                            >
                                {busy ? 'Отправка…' : 'Отправить запрос'}
                            </button>
                        </div>
                    </form>
                )}

                {/* ─── Шаг 2 ─── */}
                {step === 2 && (
                    <form onSubmit={submitReset}>
                        <div className="text-sm rounded-xl p-3 mb-4 bg-violet/10 border border-violet/30">
                            <div className="font-semibold text-violet-soft mb-1">
                                Запрос отправлен
                            </div>
                            <div className="text-white/70 text-xs leading-relaxed">
                                {fullName ? `${fullName}, ` : ''}
                                администратор свяжется с вами по номеру{' '}
                                <b className="text-white">{phoneMasked || 'из вашего профиля'}</b>{' '}
                                и сообщит <b>6-значный код</b>. Введите его здесь и задайте
                                новый пароль. Код действует 30 минут.
                            </div>
                        </div>

                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">
                            Код из 6 цифр
                        </label>
                        <input
                            className="input mb-3 text-center text-2xl tracking-[0.5em] font-mono"
                            placeholder="000000"
                            inputMode="numeric"
                            maxLength={6}
                            value={code}
                            onChange={(e) =>
                                setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                            }
                            autoFocus
                            disabled={busy}
                        />

                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">
                            Новый пароль (мин. 6 символов)
                        </label>
                        <input
                            className="input mb-3"
                            type="password"
                            placeholder="••••••••"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            autoComplete="new-password"
                            disabled={busy}
                        />

                        <label className="text-xs text-white/40 uppercase tracking-wider block mb-1">
                            Повторите пароль
                        </label>
                        <input
                            className="input mb-4"
                            type="password"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            autoComplete="new-password"
                            disabled={busy}
                        />

                        {error && (
                            <div className="text-sm text-pink bg-pink/10 rounded-xl p-3 mb-3">
                                {error}
                            </div>
                        )}

                        <div className="flex justify-between gap-2">
                            <button
                                type="button"
                                onClick={() => { setStep(1); setError(''); }}
                                disabled={busy}
                                className="btn-ghost"
                            >
                                ← Назад
                            </button>
                            <button
                                type="submit"
                                disabled={busy || code.length !== 6}
                                className="btn-primary"
                            >
                                {busy ? 'Проверка…' : 'Сменить пароль'}
                            </button>
                        </div>
                    </form>
                )}

                {/* ─── Шаг 3 ─── */}
                {step === 3 && (
                    <div className="text-center py-4">
                        <div className="text-5xl mb-3">🎉</div>
                        <div className="font-bold text-lg mb-2">Пароль изменён</div>
                        <p className="text-sm text-white/60 mb-5">
                            Теперь войдите с новым паролем. Все старые сессии
                            на других устройствах автоматически завершены.
                        </p>
                        <button onClick={close} className="btn-primary w-full">
                            Понятно
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}