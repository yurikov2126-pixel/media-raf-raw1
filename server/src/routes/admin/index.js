import { Router } from 'express';
import { auth, requireRole } from '../../middleware/auth.js';
import { hasPermission } from '../../lib/roles.js';

import rolesRouter from './roles.js';
import editorialTeamRouter from './editorialTeam.js';
import statsRouter from './stats.js';
import systemRouter from './system.js';
import storageRecoveryRouter from './storageRecovery.js';
import storageCenterRouter from './storageCenter.js';
import actionsRouter from './actions.js';           // ← добавлено
import analyticsRouter from './analytics.js';
import usersRouter from './users.js';
import coursesRouter from './courses.js';
import certificatesRouter from './certificates.js';
import moderationRouter from './moderation.js';
import backupsRouter from './backups.js';
import bulkRouter from './bulk.js';
import wikiRouter from './wiki.js';
import pushRouter from './push.js';
import notificationsRouter from './notifications.js';
import modulesRouter from './modules.js';
import onboardingRouter from './onboarding.js';
import passwordResetsRouter from './passwordResets.js';
import gamificationRouter from './gamification.js';
import practicalsRouter from './practicals.js';
import homeworkRouter from './homework.js';
import settingsRouter from './settings.js';
import dashboardRouter from './dashboard.js';
import undoRouter from './undo.js';
import searchRouter from './search.js';

const router = Router();

router.use(auth);

// Доступ к аналитике делегируется отдельно; остальные маршруты остаются ADMIN-only.
router.get('/access', async (req, res, next) => {
    try {
        res.json({ analytics: await hasPermission(req.user, 'admin.analytics.view'), admin: req.user.role === 'ADMIN' });
    } catch (error) { next(error); }
});
router.use(async (req, res, next) => {
    if (!/^\/analytics(?:\/|$)/.test(req.path)) return next();
    try {
        if (await hasPermission(req.user, 'admin.analytics.view')) return next();
        return res.status(403).json({ error: 'Нет права просмотра аналитики' });
    } catch (error) { next(error); }
});
router.use(analyticsRouter);
router.use(requireRole('ADMIN'));

router.use(rolesRouter);
router.use(editorialTeamRouter);
router.use(statsRouter);
router.use(systemRouter);
router.use('/storage-center',storageRecoveryRouter);
router.use('/storage-center',storageCenterRouter);
router.use(actionsRouter);
router.use(searchRouter);
router.use(undoRouter);
router.use(dashboardRouter);  // ← добавлено
router.use(moderationRouter);
router.use(usersRouter);
router.use(coursesRouter);
router.use(certificatesRouter);
router.use(settingsRouter);
router.use(backupsRouter);
router.use(bulkRouter);
router.use(wikiRouter);
router.use(pushRouter);
router.use(notificationsRouter);
router.use(modulesRouter);
router.use(onboardingRouter);
router.use(passwordResetsRouter);
router.use(gamificationRouter);
router.use(practicalsRouter);
router.use(homeworkRouter);

export default router;