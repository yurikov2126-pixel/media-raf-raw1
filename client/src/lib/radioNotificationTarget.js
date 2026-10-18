/**
 * Resolve radio notifications to a real destination without relying on
 * a successful asynchronous mark-read request.
 */
export function radioNotificationTarget(notification) {
  const type = String(notification?.type || '').trim().toUpperCase();
  let payload = notification?.payload || {};
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { payload = {}; }
  }
  const kind = type.replace(/[^A-Z0-9]/g, '_');
  const id = payload.playlistId || payload.playlist?.id || payload.id || '';
  if (kind === 'RADIO_PLAYLIST_SUBMITTED') {
    return '/app/radio?tab=playlists' + (id ? '&playlist=' + encodeURIComponent(String(id)) : '');
  }
  if (kind === 'RADIO_PLAYLIST_RETURNED' || kind === 'RADIO_PLAYLIST_APPROVED') {
    return '/app/radio/playlists/my' + (id ? '?playlist=' + encodeURIComponent(String(id)) : '');
  }
  return null;
}
