/**
 * Клиентская часть Web Push.
 * Требуется HTTPS и разрешение пользователя.
 */

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
}

export function isPushSupported() {
    if (typeof window === 'undefined') return false;
    return (
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
    );
}

export function isStandalone() {
    if (typeof window === 'undefined') return false;
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true
    );
}

export function isIOS() {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

export function getPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
}

/**
 * Подписка на push. Требует user gesture.
 * Возвращает { ok, subscription } или { error }.
 */
export async function subscribePush(token) {
    if (!isPushSupported()) {
        return { error: 'Push не поддерживается браузером' };
    }
    if (isIOS() && !isStandalone()) {
        return { error: 'На iPhone добавьте приложение на экран «Домой» и запустите оттуда' };
    }

    try {
        const registration = await navigator.serviceWorker.ready;

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            return { error: 'Разрешение на уведомления не выдано' };
        }

        const apiBase = import.meta.env.VITE_API || 'http://localhost:4000/api';

        const keyRes = await fetch(`${apiBase}/push/vapid-public-key`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!keyRes.ok) {
            return { error: 'Push-сервис недоступен на сервере' };
        }
        const { key } = await keyRes.json();

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(key),
            });
        }

        const saveRes = await fetch(`${apiBase}/push/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ subscription: subscription.toJSON() }),
        });

        if (!saveRes.ok) {
            const data = await saveRes.json().catch(() => ({}));
            return { error: data.error || 'Не удалось сохранить подписку' };
        }

        return { ok: true, subscription };
    } catch (e) {
        return { error: e.message || 'Ошибка подписки' };
    }
}

/**
 * Отписка.
 */
export async function unsubscribePush(token) {
    if (!isPushSupported()) return { ok: true };

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) return { ok: true };

        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        const apiBase = import.meta.env.VITE_API || 'http://localhost:4000/api';
        await fetch(`${apiBase}/push/unsubscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ endpoint }),
        }).catch(() => {});

        return { ok: true };
    } catch (e) {
        return { error: e.message };
    }
}

/**
 * Текущее состояние подписки.
 */
export async function getPushState() {
    if (!isPushSupported()) {
        return { supported: false };
    }

    try {
        const permission = Notification.permission;
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        return {
            supported: true,
            permission,
            subscribed: !!subscription,
            endpoint: subscription?.endpoint || null,
        };
    } catch {
        return { supported: true, permission: 'default', subscribed: false };
    }
}