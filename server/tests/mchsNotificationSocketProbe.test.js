import {describe,it,expect,vi} from 'vitest';
import {recordMchsTechnicalIncidents} from '../src/lib/mchsTechnicalIncidents.js';
const now=new Date('2026-10-28T17:50:00Z');
function fixture(fails=false) {
 const rows=[],notices=[],sent=[];
 const tx={
  $executeRaw:async()=>1,
  safetyMchsHealth:{findUnique:async()=>({lastSeenAt:new Date(now-200000)})},
  safetyMchsTechnicalIncident:{
   findMany:async()=>rows.filter(x=>!x.resolvedAt),
   create:async({data})=>{const row={id:'diagnostic-1',...data};rows.push(row);return row;},
   update:async()=>{throw Error('unexpected update');}
  },
  user:{findMany:async()=>[{id:'sample-admin'}]},
  notification:{create:async({data})=>{const row={id:'notice-1',...data};notices.push(row);return row;}}
 };
 const db={$transaction:async fn=>{const result=await fn(tx);if(fails)throw Error('simulated rollback');return result;}};
 const io={to:vi.fn(()=>({emit:(type,body)=>sent.push({type,body})}))};
 return {db,io,rows,notices,sent};
}
describe('isolated technical-notification transaction',()=>{
 it('emits once after storing incident and notice',async()=>{
  const h=fixture();
  await recordMchsTechnicalIncidents(h.db,now,{io:h.io});
  await recordMchsTechnicalIncidents(h.db,now,{io:h.io});
  expect(h.rows).toHaveLength(1);
  expect(h.notices).toHaveLength(1);
  expect(h.sent).toHaveLength(1);
  expect(h.sent[0].type).toBe('notification:new');
  expect(h.sent[0].body.payload.url).toContain('incident=diagnostic-1');
 });
 it('does not send on unsuccessful transaction',async()=>{
  const h=fixture(true);
  await expect(recordMchsTechnicalIncidents(h.db,now,{io:h.io})).rejects.toThrow('simulated rollback');
  expect(h.sent).toHaveLength(0);
 });
});
