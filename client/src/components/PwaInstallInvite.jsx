import { useEffect, useState } from 'react';

const STORAGE_KEY = 'mrr:pwa-install-invite:last-shown:v1';
const INSTALLED_KEY = 'mrr:pwa-install-invite:installed:v1';
const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

// Register before React mounts, otherwise Chrome can fire beforeinstallprompt
// before the banner component subscribes.
let installPrompt = null;
const listeners = new Set();
const inform = () => listeners.forEach((callback) => callback());
if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        installPrompt = event;
        inform();
    });
    window.addEventListener('appinstalled', () => {
        installPrompt = null;
        try { localStorage.setItem(INSTALLED_KEY, '1'); } catch {}
        inform();
    });
}

const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    Boolean(window.Capacitor?.isNativePlatform?.());

const isiOSSafari = () => {
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    // Other iOS browsers do not expose an install prompt. Provide Safari
    // instructions only where the Share menu supports Add to Home Screen.
    return isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
};
const isMobile = () => window.matchMedia?.('(max-width: 767px), (pointer: coarse)').matches &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

function readAllowed() {
    try {
        if (localStorage.getItem(INSTALLED_KEY) === '1') return false;
        const last = Number(localStorage.getItem(STORAGE_KEY) || 0);
        return !last || Date.now() - last >= THREE_DAYS;
    } catch { return true; }
}

export default function PwaInstallInvite() {
    const [mode, setMode] = useState(null);
    const [iosSteps, setIosSteps] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        if (!isMobile() || isStandalone()) return;
        const update = () => {
            if (isStandalone()) { setMode(null); return; }
            if (!readAllowed()) return;
            if (installPrompt) setMode('prompt');
            else if (isiOSSafari()) setMode('ios');
        };
        const delayed = window.setTimeout(update, 1600);
        listeners.add(update);
        const installed = () => { setMode(null); setDismissed(true); };
        window.addEventListener('appinstalled', installed);
        return () => {
            clearTimeout(delayed);
            listeners.delete(update);
            window.removeEventListener('appinstalled', installed);
        };
    }, []);

    useEffect(() => {
        if (!mode) return;
        // Count actual displays, not page visits and not attempts to install.
        try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
    }, [mode]);

    const close = () => {
        setExiting(true);
        window.setTimeout(() => { setDismissed(true); setMode(null); }, 230);
    };

    const install = async () => {
        if (mode === 'ios') { setIosSteps(true); return; }
        if (!installPrompt || busy) return;
        const event = installPrompt;
        installPrompt = null;
        setBusy(true);
        try {
            await event.prompt();
            const choice = await event.userChoice;
            if (choice?.outcome === 'accepted') {
                try { localStorage.setItem(INSTALLED_KEY, '1'); } catch {}
            }
        } catch (error) { console.warn('[PWA] install prompt failed', error); }
        finally { setBusy(false); close(); }
    };

    if (!mode || dismissed) return null;
    return (
        <aside className={`mrr-pwa-invite ${exiting ? 'mrr-pwa-invite--exit' : ''}`} role="dialog" aria-label="Установить приложение MEDIA RAF RAW">
            <div className="mrr-pwa-invite-glow" aria-hidden="true" />
            <div className="mrr-pwa-invite-heading">
                <div className="mrr-pwa-invite-icon-shell" aria-hidden="true">
                    <div className="mrr-pwa-invite-icon">
                        <img src="/icon-192.png" alt="" width="48" height="48" />
                    </div>
                    <span className="mrr-pwa-invite-spark mrr-pwa-invite-spark--one">✦</span>
                    <span className="mrr-pwa-invite-spark mrr-pwa-invite-spark--two">✧</span>
                </div>
                <div className="mrr-pwa-invite-main">
                    <span className="mrr-pwa-invite-eyebrow"><span className="mrr-pwa-invite-status-dot" /> УДОБНЕЕ КАК ПРИЛОЖЕНИЕ</span>
                    <div className="mrr-pwa-invite-title">MEDIA·RAF·RAW на твоём экране</div>
                    <p className="mrr-pwa-invite-description">
                        {iosSteps ? 'В Safari нажми «Поделиться» → «На экран Домой» → «Добавить».' :
                            'Открывай медиацентр одним касанием — прямо с рабочего стола.'}
                    </p>
                </div>
            </div>
            <div className="mrr-pwa-invite-actions">
                {iosSteps ? (
                    <button type="button" className="mrr-pwa-invite-install" onClick={close}>
                        Понятно <span aria-hidden="true">✓</span>
                    </button>
                ) : (
                    <button type="button" className="mrr-pwa-invite-install" onClick={install} disabled={busy}>
                        <span aria-hidden="true">↗</span>
                        {busy ? 'Подождите…' : mode === 'ios' ? 'Добавить на экран Домой' : 'Установить приложение'}
                        <span className="mrr-pwa-invite-install-arrow" aria-hidden="true">→</span>
                    </button>
                )}
                <button type="button" className="mrr-pwa-invite-later" onClick={close}>Не сейчас</button>
            </div>
            <button type="button" className="mrr-pwa-invite-close" onClick={close} aria-label="Закрыть приглашение">×</button>
        </aside>
    );
}
