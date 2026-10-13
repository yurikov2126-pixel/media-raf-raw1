import { prisma } from './prisma.js';

export const ROLE_SETTINGS_KEY = 'rbac_roles_v1';
export const BUILTIN_ROLES = Object.freeze({
  STUDENT: { name: 'Студент', description: 'Участник медиацентра', builtin: true, permissions: [] },
  MENTOR: { name: 'Наставник', description: 'Руководитель обучения и проектов', builtin: true, permissions: ['editorial.create', 'editorial.library', 'learning.practicals.review', 'learning.homework.review', 'learning.practicals.unlock'] },
  ADMIN: { name: 'Администратор', description: 'Полный системный доступ (защищённая роль)', builtin: true, permissions: ['*'] },
});
export const PERMISSIONS = [
  { id: 'editorial.create', group: 'Редакция', label: 'Создание проектов' },
  { id: 'editorial.library', group: 'Редакция', label: 'Управление общей библиотекой' },
  { id: 'learning.practicals.review', group: 'Обучение', label: 'Проверка практик (только назначенный руководитель)' },
  { id: 'learning.homework.review', group: 'Обучение', label: 'Проверка домашних заданий' },
  { id: 'learning.practicals.unlock', group: 'Обучение', label: 'Принудительная разблокировка уроков' },
];
const allowed = new Set(PERMISSIONS.map(p => p.id));
export function validCode(code) { return typeof code === 'string' && /^[A-Z][A-Z0-9_]{2,31}$/.test(code); }
export function cleanPermissions(permissions) {
  if (!Array.isArray(permissions) || permissions.some(p => !allowed.has(p))) return null;
  return [...new Set(permissions)];
}
export async function getRoles() {
  const row = await prisma.setting.findUnique({ where: { key: ROLE_SETTINGS_KEY } });
  let custom = {};
  try { custom = JSON.parse(row?.value || '{}'); } catch { custom = {}; }
  return { ...BUILTIN_ROLES, ...Object.fromEntries(Object.entries(custom).filter(([code]) => !(code in BUILTIN_ROLES))) };
}
export async function hasPermission(user, permission) {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  const role = (await getRoles())[user.role];
  return Boolean(role && (role.permissions || []).includes(permission));
}
export async function saveCustomRoles(custom) {
  return prisma.setting.upsert({
    where: { key: ROLE_SETTINGS_KEY },
    create: { key: ROLE_SETTINGS_KEY, value: JSON.stringify(custom) },
    update: { value: JSON.stringify(custom) },
  });
}
