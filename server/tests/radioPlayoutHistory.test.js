import {describe,it,expect} from 'vitest';
import {normalizeHistory,recentlyPlayed,readPlayoutHistory,recordPlayoutEvent,recordPlayoutEvents} from '../src/lib/radioPlayoutHistory.js';
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
describe('atomic crossfade history persistence',()=>{
 it('stores two sources with a single upsert inside a transaction',async()=>{
  let value,upserts=0,locks=0;
  const tx={setting:{findUnique:async()=>value?{value}:null,
    upsert:async({create,update})=>{upserts++;value=(value?update:create).value;}},
    $executeRaw:async()=>{locks++;}};
  const db={$transaction:async fn=>fn(tx)};
  const at='2026-10-18T12:00:00Z';
  await recordPlayoutEvents([{id:'a',mode:'AUTO_DJ',startedAt:at,mixed:true},
    {id:'b',mode:'AUTO_DJ',startedAt:at,mixed:true}],db);
  expect(upserts).toBe(1);
  expect(locks).toBe(1);
  expect((await readPlayoutHistory(tx)).map(e=>e.id)).toEqual(['a','b']);
 });
 it('does not write a fabricated event if there is no valid audio',async()=>{
  let writes=0;
  const db={setting:{findUnique:async()=>null,upsert:async()=>{writes++;}}};
  await recordPlayoutEvents([{id:'ghost',startedAt:'bad',mode:'AUTO_DJ'}],db);
  expect(writes).toBe(0);
 });
});
