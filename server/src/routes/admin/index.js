import { Router } from 'express';
import { auth, requireRole } from '../../middleware/auth.js';

import statsRouter from './stats.js';
import systemRouter from './system.js';
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

router.use(auth, requireRole('ADMIN'));

router.use(statsRouter);
router.use(systemRouter);
router.use(actionsRouter);
router.use(searchRouter);
router.use(undoRouter);
router.use(dashboardRouter);  // ← добавлено
router.use(analyticsRouter);
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