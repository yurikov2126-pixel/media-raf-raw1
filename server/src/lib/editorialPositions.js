import { prisma } from './prisma.js';

const KEY = 'editorial_positions_v1';
export const RADIO_HOST_POSITION = { code: 'RADIO_HOST', label: 'Радиоведущий' };
export const DEFAULT_POSITIONS = [
  { code: 'LEAD_PHOTO', label: 'Основной фотограф' },
  { code: 'ADDITIONAL_PHOTO', label: 'Дополнительный фотограф' },
  { code: 'LEAD_VIDEO', label: 'Основной видеорепортёр' },
  { code: 'GIMBAL', label: 'Оператор стабилизатора' },
  { code: 'ACTION_CAMERA', label: 'Оператор экшн-камеры' },
  { code: 'SOUND_ENGINEER', label: 'Звукорежиссёр' },
  { code: 'INTERVIEWER', label: 'Интервьюер' },
  { code: 'VIDEO_EDITOR', label: 'Монтажёр' },
  { code: 'EDITOR_IN_CHIEF', label: 'Главный редактор' },
  { code: 'PHOTO_EDITOR', label: 'Фоторедактор' },
  { code: 'REPORTER', label: 'Корреспондент' },
  { code: 'DESIGNER', label: 'Дизайнер' },
  { code: 'PRODUCER', label: 'Продюсер' },
  { code: 'CURATOR', label: 'Куратор редакции' },
  RADIO_HOST_POSITION,
];
export const validPositionCode = code => typeof code === 'string' && /^[A-Z][A-Z0-9_]{2,39}$/.test(code);
export async function getEditorialPositions(db = prisma) {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  if (!row) return DEFAULT_POSITIONS;
  try {
    const parsed = JSON.parse(row.value);
    if (Array.isArray(parsed)) {
      const list = parsed.filter(p => validPositionCode(p.code) && typeof p.label === 'string');
      return list.some(p => p.code === RADIO_HOST_POSITION.code) ? list : [...list, RADIO_HOST_POSITION];
    }
  } catch {}
  return DEFAULT_POSITIONS;
}
export async function saveEditorialPositions(positions, db = prisma) {
  return db.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(positions) },
    update: { value: JSON.stringify(positions) },
  });
}
