/** Conservative recognition for observation-only operator review. No broadcast authorization. */
export const MCHS_EVENT_TYPES = Object.freeze([
  { id: 'UAV_DANGER', label: 'Опасность атаки БПЛА' },
  { id: 'UAV_ALL_CLEAR', label: 'Отбой опасности атаки БПЛА' },
  { id: 'MISSILE_DANGER', label: 'Ракетная опасность' },
  { id: 'MISSILE_ALL_CLEAR', label: 'Отбой ракетной опасности' },
]);
export function classifyMchsObservation(title, body) {
  const text = [title, body].filter(Boolean).join(' ')
    .normalize('NFKC').toLocaleUpperCase('ru-RU')
    .replace(/Ё/g, 'Е')
    .replace(/[^А-ЯA-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  // Use explicit token boundaries: JavaScript \\b does not correctly handle Cyrillic.
  const token = pattern => new RegExp('(?:^| )' + pattern + '(?: |$)', 'u').test(text);
  const uav = token('(?:БПЛА|БЕСПИЛОТНИК(?:ОВ|И|А)?)');
  const missile = token('РАКЕТНАЯ ОПАСНОСТЬ') || token('РАКЕТНОЙ ОПАСНОСТИ') ||
                  token('РАКЕТНАЯ УГРОЗА') || token('РАКЕТНОЙ УГРОЗЫ');
  const clear = token('(?:ОТБОЙ|ОТМЕНА|ОТМЕНЕНА|ОТМЕНЕН|СНЯТА|СНЯТИЕ)');
  const danger = token('(?:ОПАСНОСТЬ|ОПАСНОСТИ|УГРОЗА|УГРОЗЫ)');
  const attack = token('(?:АТАКИ|АТАКА)');
  // Fail closed on mixed hazards or negated threat statements, even if recognisable words exist.
  if (uav && missile) return 'UNCLASSIFIED';
  if (uav && clear && (danger || attack)) return 'UAV_ALL_CLEAR';
  if (missile && clear) return 'MISSILE_ALL_CLEAR';
  if (uav && danger && attack && !clear) return 'UAV_DANGER';
  if (missile && !clear) return 'MISSILE_DANGER';
  return 'UNCLASSIFIED';
}
