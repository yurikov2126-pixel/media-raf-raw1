// Local notifications are available in the Capacitor shell only.
// This module does not register APNs tokens or replace server-side Web Push.
export function localNotificationsPlugin() {
    const capacitor = typeof window !== 'undefined' ? window.Capacitor : null;
    if (!capacitor?.isNativePlatform?.()) return null;
    return capacitor.Plugins?.LocalNotifications || null;
}

export async function localNotificationPermission() {
    const plugin = localNotificationsPlugin();
    if (!plugin) return { available: false, display: 'prompt' };
    const result = await plugin.checkPermissions();
    return { available: true, display: result.display };
}

export async function enableLocalNotifications() {
    const plugin = localNotificationsPlugin();
    if (!plugin) return { ok: false, error: 'Установите @capacitor/local-notifications и выполните cap sync ios' };
    try {
        const permission = await plugin.requestPermissions();
        if (permission.display !== 'granted') {
            return { ok: false, error: 'Уведомления запрещены в настройках iOS' };
        }
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error?.message || 'Не удалось запросить разрешение' };
    }
}

export async function sendLocalNotificationTest() {
    const plugin = localNotificationsPlugin();
    if (!plugin) throw new Error('Нативный плагин уведомлений не установлен');
    await plugin.schedule({
        notifications: [{
            id: Math.floor(Date.now() / 1000) % 2147483647,
            title: 'MEDIA·RAF·RAW',
            body: 'Локальные уведомления работают!',
            schedule: { at: new Date(Date.now() + 5000) },
        }],
    });
}
