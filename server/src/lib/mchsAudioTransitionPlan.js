/**
 * Pure, non-executable MCHS-to-radio transition *planning*.
 * It NEVER starts playout, changes radio authority or sends speaker commands.
 * External authoritative confirmation is required before implementation.
 */
export function planMchsAudioTransition({
  eventType, audioAsset, source, sourceId, ageMs, officialVerified = false,
  physicalOutputIsolated = false, publicStreamIsolated = false,
} = {}) {
  const validTypes = ['UAV_DANGER','UAV_ALL_CLEAR','MISSILE_DANGER','MISSILE_ALL_CLEAR'];
  const reasons = [];
  if (!validTypes.includes(eventType)) reasons.push('UNKNOWN_EVENT_TYPE');
  if (!audioAsset || audioAsset.category !== 'ALARM' || !audioAsset.mimeType?.startsWith('audio/') ||
      !Number.isFinite(audioAsset.durationMs) || audioAsset.durationMs <= 0) reasons.push('INVALID_ALARM_ASSET');
  if (!Number.isFinite(ageMs) || ageMs < -120000 || ageMs > 120000) reasons.push('STALE_EVENT');
  if (!officialVerified) reasons.push('OFFICIAL_CONFIRMATION_REQUIRED');
  if (!physicalOutputIsolated) reasons.push('SPEAKER_OUTPUT_NOT_ISOLATED');
  if (!publicStreamIsolated) reasons.push('PUBLIC_STREAM_NOT_ISOLATED');
  if (!['AUTO_DJ','SCHEDULED','LIVE','MANUAL_PLAYLIST'].includes(source)) reasons.push('UNKNOWN_RADIO_SOURCE');
  if (source === 'LIVE') reasons.push('LIVE_SOURCE_PROTECTED');
  return {
    permitted: false,
    executable: false,
    output: 'NONE',
    status: reasons.length ? 'BLOCKED' : 'DESIGN_REVIEW_REQUIRED',
    reasons,
    resume: { source: source || null, sourceId: sourceId || null,
      strategy: 'REQUERY_AUTHORITY_AT_RESUME' },
    fade: { inMs: 0, outMs: 0, configured: false },
  };
}
