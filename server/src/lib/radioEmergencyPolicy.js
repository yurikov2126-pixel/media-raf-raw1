/**
 * Operator-initiated station announcement policy.
 * This is NOT a certified evacuation or life-safety PA controller.
 */
export const RADIO_ALERT_MAX_MS = 180_000;
export function validateRadioAlertAsset(asset) {
  if (!asset || typeof asset.id !== 'string' || !asset.storageKey)
    throw new TypeError('Аудиофайл оповещения не найден');
  const duration = Number(asset.durationMs);
  if (!Number.isFinite(duration) || duration < 500 || duration > RADIO_ALERT_MAX_MS)
    throw new TypeError('Продолжительность оповещения должна быть от 0,5 до 180 секунд');
  if (asset.status && asset.status !== 'READY')
    throw new TypeError('Аудиофайл оповещения ещё не готов');
  return { id: asset.id, durationMs: duration };
}
