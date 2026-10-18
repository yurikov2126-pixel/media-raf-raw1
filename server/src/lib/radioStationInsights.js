/** Read-only operations statistics from generated server PCM events. */
export function summarizePlayout(events,nowMs=Date.now(),windowHours=24){
 const start=nowMs-windowHours*3600000;
 const window=events.filter(e=>{
  const time=Date.parse(e.startedAt);
  return Number.isFinite(time)&&time>=start&&time<=nowMs;
 });
 const totals={events:window.length,autoDj:0,scheduled:0,generatedMs:0,mixedEvents:0};
 const trackMap=new Map();
 for(const event of window){
  if(event.mode==='AUTO_DJ')totals.autoDj++;
  if(event.mode==='SCHEDULED')totals.scheduled++;
  if(event.mixed)totals.mixedEvents++;
  const duration=Number.isFinite(event.generatedMs)?Math.max(0,event.generatedMs):0;
  if(!event.mixed)totals.generatedMs+=duration;
  const existing=trackMap.get(event.id)||{id:event.id,name:event.name||event.id,plays:0,lastAt:event.startedAt};
  existing.plays++;
  if(Date.parse(event.startedAt)>Date.parse(existing.lastAt))existing.lastAt=event.startedAt;
  trackMap.set(event.id,existing);
 }
 return {windowHours,...totals,uniqueTracks:trackMap.size,
  tracks:[...trackMap.values()].sort((a,b)=>b.plays-a.plays||a.name.localeCompare(b.name)).slice(0,20)};
}
export function exportPlayoutCsv(events){
 const cell=v=>'"'+String(v??'').replace(/"/g,'""').replace(/^[=+@-]/,'\'$&')+'"';
 const rows=[['startedAt','id','name','mode','generatedMs','mixed','slotId'],
  ...events.map(e=>[e.startedAt,e.id,e.name,e.mode,e.generatedMs||0,!!e.mixed,e.slotId||''])];
 return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
