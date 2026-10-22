export const RADIO_WIDGETS=[
 {id:'onair',name:'Сейчас в эфире'},
 {id:'queue',name:'Далее в эфире'},
 {id:'lufs',name:'Измеритель LUFS'},
 {id:'sources',name:'Источники'},
 {id:'diagnostics',name:'Диагностика'},
 {id:'actions',name:'Быстрые действия'},
];
export const RADIO_PRESETS={
 air:{order:['onair','queue','lufs','sources','diagnostics','actions'],hidden:[],wide:['onair']},
 editor:{order:['onair','sources','actions','queue','lufs','diagnostics'],hidden:['diagnostics'],wide:['onair']},
 monitoring:{order:['diagnostics','lufs','queue','onair','sources','actions'],hidden:['actions'],wide:['diagnostics']},
};
const ids=RADIO_WIDGETS.map(w=>w.id);
export function normalizeRadioLayout(value){
 const input=value&&typeof value==='object'?value:{};
 const order=[...new Set((Array.isArray(input.order)?input.order:[]).filter(id=>ids.includes(id)))];
 return {order:[...order,...ids.filter(id=>!order.includes(id))],
  hidden:[...new Set((Array.isArray(input.hidden)?input.hidden:[]).filter(id=>ids.includes(id)&&id!=='onair'))],
  wide:[...new Set((Array.isArray(input.wide)?input.wide:[]).filter(id=>ids.includes(id)))],
 };
}
export function moveRadioWidget(layout,fromId,toId){
 if(fromId===toId||!ids.includes(fromId)||!ids.includes(toId))return normalizeRadioLayout(layout);
 const next=normalizeRadioLayout(layout);next.order.splice(next.order.indexOf(fromId),1);
 next.order.splice(next.order.indexOf(toId),0,fromId);return next;
}
export function loadRadioLayout(key){
 try {return normalizeRadioLayout(JSON.parse(localStorage.getItem(key)||'null'));}catch{return normalizeRadioLayout(RADIO_PRESETS.air);}
}
export function saveRadioLayout(key,layout){
 try{localStorage.setItem(key,JSON.stringify(normalizeRadioLayout(layout)));}catch{/* Storage unavailable; editing remains functional in session. */}
}
