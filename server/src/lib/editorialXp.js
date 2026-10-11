import { prisma } from './prisma.js';
import { getSettings as getGamificationSettings } from './gamificationSettings.js';
import { levelFromXp } from './gamificationCatalog.js';

/**
 * Called inside the same transaction as the approval.
 * A task can grant XP only once, even after reopening or repeated approval.
 */
export async function awardApprovedEditorialTask(tx, task) {
  if (!task.assigneeId || !['APPROVED', 'DONE'].includes(task.status)) return false;
  const settings = await getGamificationSettings();
  if (!settings.enabled) return false;
  const setting = await prisma.setting.findUnique({ where: { key: 'gamification_editorial_approved_xp' } });
  const raw = Number(setting?.value ?? 50);
  const amount = Number.isInteger(raw) ? Math.max(0, Math.min(1000, raw)) : 50;
  if (!amount) return false;

  const claim = await tx.editorialTaskXpAward.createMany({
    data: [{ taskId: task.id, userId: task.assigneeId, amount }],
    skipDuplicates: true,
  });
  if (!claim.count) return false;

  await tx.userStats.upsert({
    where: { userId: task.assigneeId },
    create: { userId: task.assigneeId, xp: 0, level: 1 },
    update: {},
  });
  const stats = await tx.userStats.update({
    where: { userId: task.assigneeId },
    data: { xp: { increment: amount } },
  });
  await tx.userStats.update({
    where: { userId: task.assigneeId },
    data: { level: levelFromXp(stats.xp, settings.levelThresholds) },
  });
  await tx.xpLog.create({
    data: { userId: task.assigneeId, amount, reason: 'editorial_task_approved', meta: JSON.stringify({ taskId: task.id, projectId: task.projectId }) },
  });
  await tx.notification.create({
    data: { userId: task.assigneeId, type: 'editorial_xp', payload: JSON.stringify({ taskId: task.id, amount, message: 'Задание принято: +' + amount + ' XP' }) },
  });
  return true;
}
