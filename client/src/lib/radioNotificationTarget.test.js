import { describe, expect, it } from 'vitest';
import { radioNotificationTarget } from './radioNotificationTarget.js';

describe('radio playlist notification links', () => {
  it('opens admin review with a playlist anchor', () => {
    expect(radioNotificationTarget({ type: 'RADIO_PLAYLIST_SUBMITTED', payload: { playlistId: 'p-1' } }))
      .toBe('/app/radio?tab=playlists&playlist=p-1');
  });
  it('opens student revision for JSON-string payload', () => {
    expect(radioNotificationTarget({ type: 'radio_playlist_returned', payload: '{"playlistId":"p-2"}' }))
      .toBe('/app/radio/playlists/my?playlist=p-2');
  });
  it('opens student approval for approved playlist', () => {
    expect(radioNotificationTarget({ type: 'RADIO_PLAYLIST_APPROVED', payload: { playlistId: 'p-3' } }))
      .toBe('/app/radio/playlists/my?playlist=p-3');
  });
  it('ignores unrelated notification types', () => {
    expect(radioNotificationTarget({ type: 'message', payload: { chatId: 'x' } })).toBeNull();
  });
});
