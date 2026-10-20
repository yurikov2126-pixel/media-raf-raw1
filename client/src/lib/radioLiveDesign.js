export const RADIO_LIVE_DEFAULTS={
 eyebrow:'MEDIA RADIO / ONLINE',
 headerSubtitle:'РАДИО МЕДИАЦЕНТРА',
 stationTagline:'ТВОЯ ВОЛНА',
 heroLine1:'Включай.',
 heroLine2:'Чувствуй.',
 heroLine3:'Создавай.',
 description:'Музыка, авторские программы и голоса студенческого медиацентра — там, где ты.',
 inviteEyebrow:'РАДИО, КОТОРЫМ ХОЧЕТСЯ ДЕЛИТЬСЯ',
 inviteTitle:'Передай волну дальше.',
 inviteDescription:'Любимая музыка звучит лучше вместе. Пригласи друзей послушать наш прямой эфир.',
 inviteButton:'Поделиться эфиром',
 sideFooter:'Здесь звучит то, что мы создаём вместе.',
 footerText:'Информация о треке синхронизируется с задержкой плеера (оценочно).',
 showInvite:true,
 showWaves:true,
 showSideFooter:true,
 showStationClock:false,
 accent:'#7c3aed',
 background:'#101225',
};
export const RADIO_LIVE_FIELDS=[
 ['headerSubtitle','Подпись логотипа',80],
 ['eyebrow','Надпись над плеером',80],
 ['stationTagline','Надпись справа',80],
 ['heroLine1','Слоган — строка 1',100],
 ['heroLine2','Слоган — строка 2',100],
 ['heroLine3','Слоган — строка 3',100],
 ['description','Описание станции',500],
 ['inviteEyebrow','Заголовок карточки приглашения',100],
 ['inviteTitle','Название приглашения',120],
 ['inviteDescription','Описание приглашения',500],
 ['inviteButton','Кнопка приглашения',80],
 ['sideFooter','Подпись внизу страницы',180],
 ['footerText','Текст под плеером',250],
];
export function normalizeRadioLiveDesign(input){
 const result={...RADIO_LIVE_DEFAULTS};
 if(!input||typeof input!=='object'||Array.isArray(input))return result;
 for(const [key,,max] of RADIO_LIVE_FIELDS){
  if(typeof input[key]==='string')result[key]=input[key].slice(0,max);
 }
 for(const key of ['showInvite','showWaves','showSideFooter','showStationClock']){
  if(typeof input[key]==='boolean')result[key]=input[key];
 }
 for(const key of ['accent','background']){
  if(typeof input[key]==='string'&&/^#[0-9a-fA-F]{6}$/.test(input[key]))result[key]=input[key];
 }
 return result;
}
