import { useEffect, useState } from 'react';

const DISMISS_KEY = 'mrr:pwa-install-dismissed-until';
const WEEK = 7 * 24 * 60 * 60 * 1000;
const isInstalled = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isMobile = () => window.matchMedia?.('(max-width: 767px) and (pointer: coarse)').matches;
const isIosSafari = () => {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return ios && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
};

export default function PwaInstallInvite() {
    const [installEvent, setInstallEvent] = useState(null);
    const [visible, setVisible] = useState(false);
    const [instructions, setInstructions] = useState(false);
    const [ios, setIos] = useState(false);
    const [installing, setInstalling] = useState(false);

    useEffect(() => {
        if (isInstalled() || !isMobile()) return;
        let dismissed = false;
        try { dismissed = Date.now() < Number(localStorage.getItem(DISMISS_KEY) || 0); } catch {}
        if (dismissed) return;

        let pending = null;
        let timer = null;
        const show = () => {
            if (document.visibilityState !== 'visible' || isInstalled()) return;
            timer = window.setTimeout(() => {
                if (document.visibilityState === 'visible' && !isInstalled()) setVisible(true);
            }, 3500);
        };
        const onBeforeInstallPrompt = (event) => {
            event.preventDefault();
            pending = event;
            setInstallEvent(event);
            if (!timer) show();
        };
        const onInstalled = () => {
            setVisible(false);
            setInstallEvent(null);
            pending = null;
        };
        window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
        window.addEventListener('appinstalled', onInstalled);
        const safari = isIosSafari();
        setIos(safari);
        // iOS Safari doesn't dispatch beforeinstallprompt; guide the user instead.
        if (safari) show();

        return () => {
            clearTimeout(timer);
            window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, []);

    const dismiss = () => {
        setVisible(false);
        setInstructions(false);
        try { localStorage.setItem(DISMISS_KEY, String(Date.now() + WEEK)); } catch {}
    };
    const install = async () => {
        if (ios) { setInstructions(true); return; }
        if (!installEvent || installing) return;
        setInstalling(true);
        try {
            await installEvent.prompt();
            const choice = await installEvent.userChoice;
            setInstallEvent(null);
            if (choice?.outcome === 'accepted') dismiss();
            else dismiss();
        } catch {
            setInstallEvent(null);
            dismiss();
        } finally { setInstalling(false); }
    };

    if (!visible || (!ios && !installEvent)) return null;

    return (
        <div className="mrr-pwa-install-invite" role="dialog" aria-label="Установить MEDIA·RAF·RAW">
            <div className="mrr-pwa-install-icon" aria-hidden="true">✦</div>
            <div className="mrr-pwa-install-body">
                <strong>MEDIA·RAF·RAW всегда под рукой</strong>
                <span>{ios ? 'Добавьте приложение на экран «Домой» для быстрого доступа.' : 'Установите приложение на телефон для быстрого доступа.'}</span>
                {instructions && <div className="mrr-pwa-install-guide">
                    В Safari нажмите <strong>«Поделиться»</strong> <span aria-hidden="true">□↑</span>, выберите <strong>«На экран „Домой“»</strong>, затем <strong>«Добавить»</strong>.
                </div>}
                <div className="mrr-pwa-install-actions">
                    <button type="button" className="mrr-pwa-install-primary" onClick={install} disabled={installing}>
                        {ios ? instructions ? 'Понятно' : 'Как установить' : installing ? 'Открываем установку…' : 'Установить'}
                    </button>
                    <button type="button" className="mrr-pwa-install-later" onClick={dismiss}>Не сейчас</button>
                </div>
            </div>
            <button type="button" className="mrr-pwa-install-close" onClick={dismiss} aria-label="Закрыть приглашение">×</button>
        </div>
    );
}
