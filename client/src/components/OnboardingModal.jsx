import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOnboarding } from '../store/onboarding.jsx';
import { useNotifications } from '../store/notifications.jsx';
import { isIOS, isStandalone } from '../lib/push.js';

export default function OnboardingModal() {
    const { shouldShow, steps, complete } = useOnboarding();
    const { pushState, enablePush } = useNotifications();

    const [index, setIndex] = useState(0);
    const [pushBusy, setPushBusy] = useState(false);
    const [pushError, setPushError] = useState('');
    const [pushDone, setPushDone] = useState(false);

    useEffect(() => {
        if (shouldShow) {
            setIndex(0);
            setPushDone(false);
            setPushError('');
        }
    }, [shouldShow]);

    if (!shouldShow || steps.length === 0) return null;

    const step = steps[index];
    const isFirst = index === 0;
    const isLast = index === steps.length - 1;
    const progress = ((index + 1) / steps.length) * 100;

    const next = () => {
        if (isLast) return complete();
        setIndex((i) => Math.min(i + 1, steps.length - 1));
    };
    const back = () => setIndex((i) => Math.max(i - 1, 0));

    const handleEnablePush = async () => {
        setPushBusy(true);
        setPushError('');
        try {
            const r = await enablePush();
            if (r?.error) setPushError(r.error);
            else setPushDone(true);
        } catch (e) {
            setPushError(e.message);
        } finally {
            setPushBusy(false);
        }
    };

    const pushSupported = pushState?.supported;
    const pushSubscribed = pushState?.subscribed;
    const pushDenied = pushState?.permission === 'denied';
    const iosNeedsStandalone = isIOS() && !isStandalone();

    return createPortal(
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="card max-w-lg w-full overflow-hidden animate-pop">
                {/* Прогресс-бар */}
                <div className="h-1 bg-white/5">
                    <div
                        className="h-full transition-all duration-300"
                        style={{
                            width: `${progress}%`,
                            background: 'var(--brand-gradient)',
                        }}
                    />
                </div>

                {/* Шапка */}
                <div className="flex items-center justify-between px-5 pt-4">
                    <div className="text-xs text-white/40">
                        Шаг {index + 1} из {steps.length}
                    </div>
                    <button
                        onClick={complete}
                        className="text-xs text-white/40 hover:text-white transition"
                    >
                        Пропустить
                    </button>
                </div>

                {/* Контент шага */}
                <div className="px-6 py-8 text-center">
                    <div className="text-6xl mb-5">{step.icon}</div>
                    <h2 className="text-2xl font-bold mb-3">{step.title}</h2>
                    <p className="text-white/60 text-sm leading-relaxed max-w-md mx-auto">
                        {step.text}
                    </p>

                    {step.kind === 'notifications' && (
                        <div className="mt-6">
                            {!pushSupported && (
                                <div className="text-sm text-white/50 bg-white/5 rounded-xl p-3">
                                    Ваш браузер не поддерживает push-уведомления.
                                    Попробуйте Chrome, Firefox или Safari.
                                </div>
                            )}

                            {pushSupported && pushDenied && (
                                <div className="text-sm text-pink bg-pink/10 rounded-xl p-3">
                                    Уведомления заблокированы в настройках браузера.
                                    Разрешите их для этого сайта и обновите страницу.
                                </div>
                            )}

                            {pushSupported && iosNeedsStandalone && !pushDenied && !pushSubscribed && (
                                <div className="text-sm text-orange-300 bg-orange-500/10 rounded-xl p-3">
                                    📱 На iPhone уведомления работают только если добавить
                                    сайт на экран «Домой»: <b>Поделиться → На экран «Домой»</b>.
                                    Откройте приложение с иконки и вернитесь к этому шагу.
                                </div>
                            )}

                            {pushSupported && !pushDenied && !iosNeedsStandalone && pushSubscribed && (
                                <div className="text-sm text-lime bg-lime/10 rounded-xl p-3">
                                    ✓ Уведомления включены. Отлично!
                                </div>
                            )}

                            {pushSupported && !pushDenied && !iosNeedsStandalone && !pushSubscribed && (
                                <>
                                    <button
                                        onClick={handleEnablePush}
                                        disabled={pushBusy}
                                        className="btn-primary"
                                    >
                                        {pushBusy ? 'Подключение…' : '🔔 Включить уведомления'}
                                    </button>
                                    {pushError && (
                                        <div className="mt-2 text-xs text-pink">{pushError}</div>
                                    )}
                                    {pushDone && (
                                        <div className="mt-2 text-xs text-lime">✓ Готово</div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Навигация */}
                <div className="px-5 pb-5 flex items-center justify-between gap-3">
                    <button
                        onClick={back}
                        disabled={isFirst}
                        className="btn-ghost !py-2 text-sm disabled:opacity-30"
                    >
                        ← Назад
                    </button>
                    <div className="flex-1" />
                    <button onClick={next} className="btn-primary !py-2">
                        {isLast ? 'Начать!' : 'Далее →'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}