/**
 * Resolve a deterministic position in the Moscow-scheduled station timeline.
 * Input timestamps are absolute instants (UTC); Moscow is only the editor's display timezone.
 * Returns no audio bytes. Safe for all authorized agents to use as a clock reference.
 */
export function resolveRadioCursor(slots, nowMs = Date.now()) {
  const now = Number(nowMs);
  if (!Number.isFinite(now)) throw new TypeError('Invalid station clock');
  const slot = slots.find(item => {
    const start = new Date(item.startAt).getTime();
    const end = new Date(item.endAt).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && start <= now && now < end;
  });
  if (!slot) return { status: 'IDLE', at: new Date(now).toISOString(), slot: null, track: null };
  const offsetMs = Math.max(0, now - new Date(slot.startAt).getTime());
  let consumedMs = 0;
  for (const item of slot.playlist.items) {
    const length = item.asset.durationMs;
    if (!Number.isSafeInteger(length) || length <= 0) throw new TypeError('Invalid track duration');
    if (offsetMs < consumedMs + length) return {
      status: 'SCHEDULED',
      at: new Date(now).toISOString(),
      slot: { id: slot.id, playlistId: slot.playlistId, name: slot.playlist.name,
        startAt: new Date(slot.startAt).toISOString(), endAt: new Date(slot.endAt).toISOString() },
      track: { id: item.asset.id, name: item.asset.name,
        offsetMs: offsetMs - consumedMs, durationMs: length, index: slot.playlist.items.indexOf(item) },
    };
    consumedMs += length;
  }
  // A deliberately unfilled tail never loops the playlist or silently resets it.
  return { status: 'IDLE', at: new Date(now).toISOString(),
    slot: { id: slot.id, playlistId: slot.playlistId, name: slot.playlist.name,
      startAt: new Date(slot.startAt).toISOString(), endAt: new Date(slot.endAt).toISOString() },
    track: null };
}
