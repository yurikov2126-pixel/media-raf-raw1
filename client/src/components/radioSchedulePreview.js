// Client-side preview only. Server stays authoritative for slot duration/conflicts.
export function previewScheduleChange(slots,slot,startLocal,durationMinutes){
 const start=typeof startLocal==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startLocal)
  ?Date.parse(startLocal+':00+03:00'):NaN;
 const duration=Number(durationMinutes);
 if(!Number.isFinite(start)||!Number.isFinite(duration)||duration<=0||duration>720)
  return {valid:false,conflicts:[],start:null,end:null,reason:'Укажите корректные дату, время и продолжительность'};
 const end=start+duration*60000;
 const conflicts=slots.filter(item=>item.id!==slot?.id&&Date.parse(item.startAt)<end&&Date.parse(item.endAt)>start);
 return {valid:true,start,end,conflicts,reason:conflicts.length?'Интервал пересекается с '+conflicts.length+' заданиями':'Пересечений в загруженной сетке нет'};
}
