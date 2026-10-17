import { Router } from 'express';
import { auth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(auth, requireRole('ADMIN'));

// This endpoint is intentionally read-only until the radio device protocol
// and the safety requirements for amplifier control are implemented.
router.get('/status', (_req, res) => res.json({
    enabled: true,
    phase: 'SETUP',
    playout: 'NOT_CONFIGURED',
    amplifier: 'NOT_CONNECTED',
}));

export default router;
