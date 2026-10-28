/**
 * Pure radio authority recovery decision. Does not authorize or perform audio output.
 * A saved source identifier is only a hint: always trust current schedule/live authority.
 */
export function planRadioResumeAfterExternalAudio({
  previous, current, scheduleActive, scheduleKnown = false, liveActive = false,
} = {}) {
  const blocked = reason => ({ action: 'NO_ACTION', reason, executable: false });
  if (!scheduleKnown || typeof scheduleActive !== 'boolean') return blocked('SCHEDULE_UNKNOWN');
  if (!current || !['AUTO_DJ','SCHEDULED','MANUAL_PLAYLIST','LIVE'].includes(current.mode))
    return blocked('CURRENT_AUTHORITY_UNKNOWN');
  if (liveActive || current.mode === 'LIVE') return blocked('LIVE_HAS_PRIORITY');
  if (scheduleActive) {
    if (current.mode !== 'SCHEDULED' || !current.slotId) return blocked('SCHEDULE_SOURCE_UNRESOLVED');
    return { action:'RESOLVE_SCHEDULED_AT_CURRENT_POSITION', slotId:current.slotId,
      resumePreviousTrack:false, executable:false };
  }
  if (current.mode === 'MANUAL_PLAYLIST' && current.playlistId)
    return { action:'RESOLVE_MANUAL_PLAYLIST_AT_CURRENT_POSITION',
      playlistId:current.playlistId, resumePreviousTrack:false, executable:false };
  if (current.mode === 'AUTO_DJ')
    return { action:'SELECT_NEXT_AUTODJ_FROM_CURRENT_AUTHORITY',
      previousTrackId:previous?.trackId || null, resumePreviousTrack:false, executable:false };
  return blocked('AUTHORITY_UNRESOLVED');
}
