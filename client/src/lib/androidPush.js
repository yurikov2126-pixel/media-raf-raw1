import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { api } from '../api/client.js';

let listeners = [];
let currentToken = null;
let generation = 0;

export async function stopAndroidPush(authToken) {
    ++generation;
    const fcmToken = currentToken;
    currentToken = null;
    await Promise.allSettled(listeners.map((listener) => listener.remove()));
    listeners = [];
    if (authToken && fcmToken) {
        await api('/mobile-push/unregister', {
            method: 'POST', token: authToken, body: { token: fcmToken },
        });
    }
}

export async function startAndroidPush(authToken) {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android' || !authToken) return;
    const id = ++generation;
    await Promise.allSettled(listeners.map((listener) => listener.remove()));
    listeners = [];
    const permission = await PushNotifications.checkPermissions();
    // Never display a permission prompt on startup: that needs a user action.
    if (permission.receive !== 'granted' || id !== generation) return;

    const registration = await PushNotifications.addListener('registration', async ({ value }) => {
        if (id !== generation || !value) return;
        try {
            await api('/mobile-push/register', {
                method: 'POST', token: authToken, body: { token: value },
            });
            if (id === generation) currentToken = value;
        } catch (error) {
            console.warn('[android-push] Device registration failed:', error?.message);
        }
    });
    if (id !== generation) { await registration.remove(); return; }
    listeners.push(registration);
    const errorListener = await PushNotifications.addListener('registrationError', (error) => {
        console.warn('[android-push] Native registration error:', error?.error || 'unknown');
    });
    if (id !== generation) { await errorListener.remove(); return; }
    listeners.push(errorListener);
    await PushNotifications.register();
}

// Call only from a user-initiated button, after authentication.
export async function enableAndroidPush(authToken) {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
        return { ok: false, error: 'Доступно только в Android-приложении' };
    }
    const result = await PushNotifications.requestPermissions();
    if (result.receive !== 'granted') return { ok: false, error: 'Нет разрешения на уведомления' };
    await startAndroidPush(authToken);
    return { ok: true };
}
