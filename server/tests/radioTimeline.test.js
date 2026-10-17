import { describe, expect, it } from 'vitest';
import { resolveRadioCursor } from '../src/lib/radioTimeline.js';

const base = Date.parse('2026-10-17T12:00:00.000Z');
const slots = [{
  id: 'slot', playlistId: 'playlist', startAt: new Date(base), endAt: new Date(base+180000),
  playlist: { name: 'Тест', items: [
    { asset: { id: 'first', name: 'Первый', durationMs: 60000 } },
    { asset: { id: 'second', name: 'Второй', durationMs: 120000 } },
  ] },
}];
describe('radio timeline', () => {
  it('does not restart the first track on a mid-slot failover', () => {
    expect(resolveRadioCursor(slots,base+90000).track).toMatchObject({ id:'second',offsetMs:30000,index:1 });
  });
  it('honors exact track boundaries', () => {
    expect(resolveRadioCursor(slots,base+60000).track).toMatchObject({id:'second',offsetMs:0});
  });
  it('returns idle outside the scheduled window', () => {
    expect(resolveRadioCursor(slots,base-1).status).toBe('IDLE');
    expect(resolveRadioCursor(slots,base+180000).status).toBe('IDLE');
  });
  it('does not loop if the slot is longer than the playlist', () => {
    const extended=[{...slots[0],endAt:new Date(base+240000)}];
    expect(resolveRadioCursor(extended,base+210000)).toMatchObject({status:'IDLE',track:null});
  });
});
