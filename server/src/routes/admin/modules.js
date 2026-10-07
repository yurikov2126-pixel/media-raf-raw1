import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { MODULES, getModulesState, setModuleEnabled } from '../../lib/modules.js';
import { safe } from './_shared.js';

const router = Router();

/* ═══════════ МОДУЛИ ПЛАТФОРМЫ ═══════════ */

router.get(
    '/modules',
    safe(async (_req, res) => {
        const state = await getModulesState();
        res.json({
            modules: MODULES.map((m) => ({
                key: m.key,
                label: m.label,
                icon: m.icon,
                description: m.description,
                enabled: state[m.key],
            })),
        });
    })
);

router.put(
    '/modules',
    safe(async (req, res) => {
        const { modules } = req.body;
        if (!modules || typeof modules !== 'object') {
            return res.status(400).json({ error: 'modules обязателен' });
        }

        const current = await getModulesState();
        const next = { ...current, ...modules };
        const anyEnabled = Object.values(next).some(Boolean);
        if (!anyEnabled) {
            return res.status(400).json({ error: 'Хотя бы один модуль должен быть включён' });
        }

        for (const [key, enabled] of Object.entries(modules)) {
            await setModuleEnabled(key, !!enabled);
        }

        await prisma.adminAction.create({
            data: {
                adminId: req.user.id,
                action: 'modules_update',
                payload: JSON.stringify(modules),
                affected: Object.keys(modules).length,
            },
        }).catch(() => {});

        res.json({ ok: true });
    })
);

export default router;