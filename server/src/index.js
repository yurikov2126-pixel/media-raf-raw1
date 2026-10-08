import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';

import { app, corsOptions } from './app.js';
import { initSocket } from './socket.js';
import { setIo } from './lib/notify.js';
import { startCron } from './lib/cron.js';
import { schedulePushCleanup } from './lib/pushCleanupCron.js';
import { scheduleNotifyCleanup } from './lib/notifyCleanupCron.js';
import { schedulePasswordResetCleanup } from './lib/passwordResetCron.js';
import { scheduleInactivityCharge } from './lib/gamificationCron.js';
import { scheduleDeadlineReminders } from './lib/deadlineCron.js';
import { scheduleDripUnlockNotifications } from './lib/dripCron.js';
import { startPendingDeletionWorker } from './lib/pendingDeletion.js';


/* ─────────── HTTP-сервер + Socket.IO ─────────── */
const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions });
setIo(io);

/* ─────────── Обработчики ошибок процесса ─────────── */
process.on('unhandledRejection', (reason) => {
    console.error('[process] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('[process] uncaughtException:', err);
});

/* ─────────── Запуск ─────────── */
initSocket(io);
startCron();
schedulePushCleanup();
scheduleNotifyCleanup();
schedulePasswordResetCleanup();
scheduleInactivityCharge();
scheduleDeadlineReminders();
scheduleDripUnlockNotifications();
startPendingDeletionWorker();

const PORT = process.env.PORT || 4000;
server.listen(PORT, () =>
    console.log(`🚀 MEDIA-RAF-RAW API на http://localhost:${PORT}`)
);