import { useState } from 'react';
import { useNetwork } from '../store/network.jsx';

/* Полноэкранный офлайн-экран.
   Показывается:
     - в RootGate, если есть сохранённый токен, но не удаётся получить user;
     - в Private, если пользователь не восстановлен и сети нет.
   Стили — .mrr-offline* в styles/index.css. */
export default function OfflineScreen() {
    const { retry } = useNetwork();
    const [checking, setChecking] = useState(false);

    const handleRetry = async () => {
        setChecking(true);
        const started = Date.now();
        try {
            await retry();
        } finally {
            // даём визуальный отклик минимум 400 мс — иначе кнопка «мигает»
            const elapsed = Date.now() - started;
            const wait = Math.max(0, 400 - elapsed);
            setTimeout(() => setChecking(false), wait);
        }
    };

    return (
        <div className="mrr-offline" role="alert" aria-live="assertive">
            <div className="mrr-offline__inner">
                <div className="mrr-offline__icon" aria-hidden="true">
                    <svg
                        viewBox="0 0 64 64"
                        width="72"
                        height="72"
                        fill="none"
                    >
                        <path
                            d="M8 22c13-11 35-11 48 0"
                            stroke="currentColor"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            opacity=".35"
                        />
                        <path
                            d="M16 32c9-7 23-7 32 0"
                            stroke="currentColor"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            opacity=".35"
                        />
                        <path
                            d="M24 42c4.5-3.5 11.5-3.5 16 0"
                            stroke="currentColor"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            opacity=".35"
                        />
                        <circle cx="32" cy="52" r="3.5" fill="currentColor" opacity=".35" />
                        <line
                            x1="14"
                            y1="12"
                            x2="50"
                            y2="52"
                            stroke="currentColor"
                            strokeWidth="4"
                            strokeLinecap="round"
                        />
                    </svg>
                </div>

                <h1 className="mrr-offline__title">Нет подключения</h1>

                <p className="mrr-offline__text">
                    Не удаётся связаться с сервером. Проверьте интернет, Wi-Fi
                    или отключите VPN — и попробуйте снова.
                </p>

                <button
                    type="button"
                    className="mrr-offline__btn"
                    onClick={handleRetry}
                    disabled={checking}
                >
                    {checking ? 'Проверяем…' : 'Повторить'}
                </button>
            </div>
        </div>
    );
}