import {describe,it,expect} from 'vitest';
import {normalizeHistory,recentlyPlayed,readPlayoutHistory,recordPlayoutEvent} from '../src/lib/radioPlayoutHistory.js';
describe('server playout event journal',()=>{
 it('rejects unconfirmed and malformed history entries',()=>{
  expect(normalizeHistory([{id:'a',startedAt:'bad',mode:'AUTO_DJ'},null,{id:'ok',startedAt:'2026-10-18T12:00:00Z',mode:'SCHEDULED'}])).toHaveLength(1);
 });
 it('keeps at most 250 events',()=>{
  const rows=Array.from({length:300},(_,i)=>({id:'a'+i,startedAt:'2026-10-18T12:00:00Z',mode:'AUTO_DJ'}));
  expect(normalizeHistory(rows)).toHaveLength(250);
 });
 it('checks time windows without claiming acoustic reception',()=>{
  const list=[{id:'a',startedAt:'2026-10-18T12:00:00Z',mode:'AUTO_DJ'}];
  expect(recentlyPlayed(list,'a',60,Date.parse('2026-10-18T12:45:00Z'))).toBe(true);
  expect(recentlyPlayed(list,'a',30,Date.parse('2026-10-18T12:45:00Z'))).toBe(false);
 });
 it('persists and reads in Setting without schema migration',async()=>{
  let value;
  const db={setting:{findUnique:async()=>value?{value}:null,upsert:async({create,update})=>{value=(value?update:create).value;}}};
  await recordPlayoutEvent({id:'x',startedAt:'2026-10-18T12:00:00Z',mode:'AUTO_DJ',generatedMs:5000},db);
  expect((await readPlayoutHistory(db))[0].generatedMs).toBe(5000);
 });
});