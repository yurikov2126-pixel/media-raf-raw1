import cron from 'node-cron';
import { createBackup, cleanupOld } from './backup.js';

export function startCron() {
    // Автобэкап каждый день в 03:00
    cron.schedule('0 3 * * *', () => {
        try {
            const r = createBackup('auto');
            console.log('🗄️ Автобэкап:', r.filename);
            const removed = cleanupOld(30);
            if (removed) console.log(`🗑️ Удалено старых бэкапов: ${removed}`);
        } catch (e) {
            console.error('Ошибка автобэкапа:', e);
        }
    });

    console.log('⏰ Cron запущен (автобэкап в 03:00)');
}