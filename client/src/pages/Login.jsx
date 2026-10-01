import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../store/auth.jsx';
import { Sticker } from '../stickers/pack.jsx';

export default function Login() {
    const { user, loginWithPassword, register, loading } = useAuth();
    const nav = useNavigate();
    const [mode, setMode] = useState('login');
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phoneTail, setPhoneTail] = useState('');
    const [username, setUsername] = useState('');
    const [direction, setDirection] = useState('photo');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    // Если пользователь уже авторизован и попал на /login — редиректим в /app
    useEffect(() => {
        if (!loading && user) nav('/app', { replace: true });
    }, [user, loading, nav]);

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            if (mode === 'login') {
                if (!login.trim() || !password) throw new Error('Введите логин и пароль');
                await loginWithPassword(login.trim(), password);
            } else {
                if (!firstName.trim() || !lastName.trim()) throw new Error('Имя и фамилия обязательны');
                if (phoneTail.length !== 10) throw new Error('Введите 10 цифр номера телефона');
                if (!username.trim()) throw new Error('Введите @ник');
                if (password.length < 6) throw new Error('Пароль не короче 6 символов');
                await register({
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    phone: `+7${phoneTail}`,
                    username: username.trim().replace(/^@/, ''),
                    password,
                    direction,
                });
            }
            nav('/app', { replace: true });
        } catch (err) {
            setError(err.message || 'Ошибка');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="min-h-screen grid md:grid-cols-2 safe-top">
            {/* Левая декоративная колонка — только на ПК */}
            <div className="hidden md:flex flex-col justify-center items-center p-10 relative overflow-hidden">
                <div className="absolute inset-0 opacity-40" style={{ background: 'var(--brand-gradient)' }} />
                <div className="relative z-10 text-center">
                    <Sticker id="camera" size={180} />
                    <h1 className="text-4xl font-bold mt-6">MEDIA·RAF·RAW</h1>
                    <p className="text-white/70 mt-2">Твоя медиа-команда</p>
                </div>
            </div>

            {/* Форма */}
            <div className="flex items-center justify-center p-6">
                <form onSubmit={submit} className="w-full max-w-md card p-8">
                    <Link to="/" className="text-sm text-white/40 hover:text-white">← На главную</Link>
                    <h2 className="text-3xl font-bold mt-4 mb-6">
                        {mode === 'login' ? 'Вход' : 'Регистрация'}
                    </h2>

                    {mode === 'login' ? (
                        <>
                            <input
                                className="input mb-3"
                                placeholder="Телефон, @ник или email"
                                value={login}
                                onChange={(e) => setLogin(e.target.value)}
                                autoComplete="username"
                                autoFocus
                            />
                            <input
                                className="input mb-4"
                                type="password"
                                placeholder="Пароль"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                            />
                        </>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <input
                                    className="input"
                                    placeholder="Имя"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    autoComplete="given-name"
                                    required
                                />
                                <input
                                    className="input"
                                    placeholder="Фамилия"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    autoComplete="family-name"
                                    required
                                />
                            </div>

                            <div className="flex mb-3">
                                <span className="input !rounded-r-none !w-14 grid place-items-center text-white/60">+7</span>
                                <input
                                    className="input !rounded-l-none flex-1"
                                    placeholder="999 123-45-67"
                                    inputMode="tel"
                                    value={phoneTail}
                                    onChange={(e) => setPhoneTail(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                    autoComplete="tel"
                                    required
                                />
                            </div>

                            <input
                                className="input mb-3"
                                placeholder="@ник (латиница, цифры, _)"
                                value={username}
                                onChange={(e) => setUsername(e.target.value.replace(/^@/, ''))}
                                autoComplete="username"
                                required
                            />

                            <input
                                className="input mb-3"
                                type="password"
                                placeholder="Пароль (мин. 6 символов)"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="new-password"
                                required
                            />

                            <select
                                className="input mb-4"
                                value={direction}
                                onChange={(e) => setDirection(e.target.value)}
                            >
                                <option value="photo">📸 Фото</option>
                                <option value="video">🎥 Видео</option>
                                <option value="radio">📻 Радио</option>
                                <option value="sound">🎚️ Звук</option>
                            </select>
                        </>
                    )}

                    {error && <p className="text-pink text-sm mb-3">{error}</p>}

                    <button className="btn-primary w-full" disabled={busy}>
                        {busy ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
                    </button>

                    <button
                        type="button"
                        onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                        className="text-sm text-white/50 mt-4 w-full text-center hover:text-white transition"
                    >
                        {mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
                    </button>
                </form>
            </div>
        </div>
    );
}