/** Conservative classification of Android notification text for operator REVIEW only.
 *  Never an authorization to broadcast or a claim of official provenance.
 */
export const MCHS_EVENT_TYPES = Object.freeze([
  { id: 'UAV_DANGER', label: 'Опасность атаки БПЛА' },
  { id: 'UAV_ALL_CLEAR', label: 'Отбой опасности атаки БПЛА' },
  { id: 'MISSILE_DANGER', label: 'Ракетная опасность' },
  { id: 'MISSILE_ALL_CLEAR', label: 'Отбой ракетной опасности' },
]);
export function classifyMchsObservation(title, body) {
  const text = [title, body].filter(Boolean).join(' ')
    .normalize('NFKC').toLocaleUpperCase('ru-RU')
    .replace(/Ё/g, 'Е').replace(/[\u00a0\s]+/g, ' ').trim();
  // End-of-alert takes precedence over a threat mention when both appear.
  const uavClear = /\b(ОТБОЙ|ОТМЕНА|СНЯТА|СНЯТИЕ)\b[^.!?]{0,85}\b(ОПАСНОСТ[ЬИ]|УГРОЗ[ЫА]|АТАК[ЫА])\b[^.!?]{0,85}\b(БПЛА|БЕСПИЛОТНИК)/u.test(text) ||
    /\b(ОПАСНОСТЬ|УГРОЗА)\b[^.!?]{0,85}\b(АТАКИ\s+)?(БПЛА|БЕСПИЛОТНИК)/u.test(text) && /\b(ОТБОЙ|ОТМЕНЕНА|ОТМЕНЕН|СНЯТА)\b/u.test(text);
  const missileClear = /\b(ОТБОЙ|ОТМЕНА|СНЯТА|СНЯТИЕ)\b[^.!?]{0,100}\bРАКЕТНОЙ\s+(ОПАСНОСТИ|УГРОЗЫ)\b/u.test(text) ||
    /\bРАКЕТНАЯ\s+(ОПАСНОСТЬ|УГРОЗА)\b[^.!?]{0,85}\b(ОТБОЙ|ОТМЕНЕНА|ОТМЕНЕН|СНЯТА)\b/u.test(text);
  const uavDanger = /\b(ОПАСНОСТЬ|УГРОЗА)\s+(АТАКИ\s+)?(БПЛА|БЕСПИЛОТНИКОВ?)\b/u.test(text);
  const missileDanger = /\bРАКЕТНАЯ\s+(ОПАСНОСТЬ|УГРОЗА)\b/u.test(text);
  const matches = [uavClear && 'UAV_ALL_CLEAR', missileClear && 'MISSILE_ALL_CLEAR',
    uavDanger && !uavClear && 'UAV_DANGER', missileDanger && !missileClear && 'MISSILE_DANGER'].filter(Boolean);
  return matches.length === 1 ? matches[0] : 'UNCLASSIFIED';
}
