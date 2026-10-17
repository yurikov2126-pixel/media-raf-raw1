import { useState } from 'react';
import Icon from '../../../../components/Icon.jsx';
import MenuPreview from './MenuPreview.jsx';
import './visual-menu.css';

const DEFAULT_DESKTOP = [
    { to: '/app', label: 'Главная', icon: 'dashboard', end: true },
    { to: '/app/feed', label: 'Лента', icon: 'feed' },
    { to: '/app/chats', label: 'Чаты', icon: 'message' },
    { to: '/app/courses', label: 'Обучение', icon: 'book' },
    { to: '/app/wiki', label: 'Wiki', icon: 'library' },
    { to: '/app/editorial', label: 'Редакция', icon: 'newspaper' },
    { to: '/app/leaderboard', label: 'Рейтинг', icon: 'trophy' },
    { to: '/app/mentor', label: 'Руководителю', icon: 'users', roles: ['MENTOR', 'ADMIN'] },
    { to: '/app/admin', label: 'Админка', icon: 'settings', roles: ['ADMIN'] },
];
const DEFAULT_MOBILE = [
    { to: '/app', label: 'Главная', icon: 'dashboard' },
    { to: '/app/feed', label: 'Лента', icon: 'feed' },
    { to: '/app/u/me', label: 'Профиль', icon: 'user' },
    { to: '/app/chats', label: 'Чаты', icon: 'message' },
    { action: 'more', label: 'Ещё', icon: 'more' },
];
const DEFAULT_EXTRA = [
    { to: '/app/courses', label: 'Обучение', icon: 'book' },
    { to: '/app/wiki', label: 'Wiki', icon: 'library' },
    { to: '/app/editorial', label: 'Редакция', icon: 'book' },
    { to: '/app/leaderboard', label: 'Рейтинг', icon: 'trophy' },
    { to: '/app/notifications', label: 'Уведомления', icon: 'bell' },
    { to: '/app/radio', label: 'Радио', icon: 'radioStudio' },
    { to: '/app/mentor', label: 'Руководителю', icon: 'users', roles: ['MENTOR', 'ADMIN'] },
    { to: '/app/admin', label: 'Админка', icon: 'settings', roles: ['ADMIN'] },
];
const parse = (raw, fallback) => { try { const v = JSON.parse(raw || 'null'); return Array.isArray(v) ? v : fallback; } catch { return fallback; } };
const CONFIG = {
    desktop: { key: 'nav_items', label: 'ПК · боковое меню' },
    mobile: { key: 'nav_mobile_items', extra: 'nav_mobile_more_items', label: 'Мобильный браузер' },
    pwa: { key: 'nav_pwa_items', extra: 'nav_pwa_more_items', label: 'PWA · установленное приложение' },
};
const CATALOG = [
 ...DEFAULT_DESKTOP,...DEFAULT_MOBILE,...DEFAULT_EXTRA,
 {to:'/app/radio',label:'Радио',icon:'radioStudio'},
 {to:'/app/seasons',label:'Сезоны',icon:'trophy'},
 {to:'/app/stickers',label:'Стикеры',icon:'image'},
].filter((item,index,array)=>array.findIndex(other=>(other.action||other.to)===(item.action||item.to))===index);
const identity = item => item.action || item.to;
function VisualItems({items,onChange,mobile=false,more=false,library=[]}){
 const [dragged,setDragged]=useState(null);
 const [over,setOver]=useState(null);
 const move=(from,to)=>{if(from===to||from<0||to<0||to>=items.length)return;const next=[...items];const [item]=next.splice(from,1);next.splice(to,0,item);onChange(next)};
 const add=item=>{if(mobile&&!more&&items.length>=5)return;if(items.some(x=>identity(x)===identity(item)))return;onChange([...items,{...item}])};
 const drop=(index,event)=>{event.preventDefault();if(dragged!==null)move(dragged,index);setDragged(null);setOver(null)};
 return <div className="mrr-menu-builder">
  <div className="mrr-menu-builder__hint">Перетаскивайте карточки мышью, чтобы менять порядок. Нажмите ×, чтобы скрыть раздел, или добавьте его из библиотеки ниже.</div>
  <div className={mobile&&!more?'mrr-menu-builder__bottom':'mrr-menu-builder__items'}>
   {items.map((item,i)=><div key={identity(item)||i} className={'mrr-menu-builder__item '+(over===i?'is-over':'')} draggable onDragStart={event=>{setDragged(i);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(i))}} onDragOver={event=>{event.preventDefault();setOver(i)}} onDrop={event=>drop(i,event)} onDragEnd={()=>{setDragged(null);setOver(null)}}>
    <span className="mrr-menu-builder__handle" aria-hidden="true">⠿</span><Icon name={item.icon||'dashboard'} size={22}/><span className="mrr-menu-builder__name">{item.label}</span>
    <button type="button" className="mrr-menu-builder__remove" aria-label={'Убрать '+item.label} title="Убрать из меню" onClick={()=>onChange(items.filter((_,j)=>i!==j))}>×</button>
    <div className="mrr-menu-builder__arrows"><button type="button" aria-label={'Поднять '+item.label} disabled={i===0} onClick={()=>move(i,i-1)}>↑</button><button type="button" aria-label={'Опустить '+item.label} disabled={i===items.length-1} onClick={()=>move(i,i+1)}>↓</button></div>
   </div>)}
   {!items.length&&<div className="mrr-menu-builder__empty">Здесь пока нет разделов. Добавьте их из библиотеки.</div>}
  </div>
  <div className="mrr-menu-builder__library-title">Добавить раздел в меню</div>
  <div className="mrr-menu-builder__library">{library.filter(item=>!items.some(x=>identity(x)===identity(item))).map(item=><button type="button" key={identity(item)} disabled={mobile&&!more&&items.length>=5} onClick={()=>add(item)}><Icon name={item.icon||'dashboard'} size={19}/><span>{item.label}</span><b>＋</b></button>)}</div>
  {mobile&&!more&&<p className="mrr-menu-builder__hint">Нижняя панель: {items.length} из 5 мест. Остальные разделы размещайте в «Ещё».</p>}
 </div>;
}
export default function MenuEditor({ settings, update }) {
    const [device, setDevice] = useState('desktop');
    const [area, setArea] = useState('primary');
    const cfg = CONFIG[device];
    const key = area === 'extra' && cfg.extra ? cfg.extra : cfg.key;
    const fallback = device === 'desktop' ? DEFAULT_DESKTOP : area === 'extra' ? DEFAULT_EXTRA : DEFAULT_MOBILE;
    const saved = parse(settings[key], fallback);
    const items = device === 'desktop' && settings.nav_desktop_customized !== 'true'
        ? [...saved, ...DEFAULT_DESKTOP.filter(item => !saved.some(existing => existing.to === item.to))]
        : saved;
    const previewPrimary = device === 'desktop' ? items : parse(settings[cfg.key], DEFAULT_MOBILE);
    const previewExtra = device === 'desktop' ? [] : parse(settings[cfg.extra], DEFAULT_EXTRA);
    const library = area === 'extra' ? CATALOG.filter(x=>x.action!=='more') : CATALOG;
    const setItems = (value) => update({ [key]: JSON.stringify(value), ...(device === 'desktop' ? { nav_desktop_customized: 'true' } : {}) });
    return <div className="space-y-5">
        <div><h3 className="font-semibold">Настройка навигации для разных устройств</h3><p className="text-sm text-white/50">Каждый вариант сохраняется отдельно. Права доступа проверяются сайтом независимо от меню.</p></div>
        <div className="flex flex-wrap gap-2">{Object.entries(CONFIG).map(([value, c]) => <button type="button" key={value} aria-pressed={device === value} className={device === value ? 'chip bg-violet text-white' : 'chip bg-white/5'} onClick={() => { setDevice(value); setArea('primary'); }}>{c.label}</button>)}</div>
        {cfg.extra && <div className="flex gap-2"><button type="button" className={area === 'primary' ? 'chip bg-violet text-white' : 'chip bg-white/5'} onClick={() => setArea('primary')}>Нижняя панель</button><button type="button" className={area === 'extra' ? 'chip bg-violet text-white' : 'chip bg-white/5'} onClick={() => setArea('extra')}>Меню «Ещё»</button></div>}
        <div className="rounded-xl border border-white/10 p-3 text-xs text-white/60">{device === 'desktop' ? 'Полный список пунктов реального бокового меню. Системные разделы также можно переставлять или скрывать; доступ по ролям остаётся защищённым.' : area === 'primary' ? 'Пункты нижней панели. Для открытия дополнительного меню оставьте пункт с действием «Ещё».' : 'Пункты, которые открываются в меню «Ещё».'}</div>
        <MenuPreview device={device} primary={previewPrimary} extra={previewExtra} settings={settings}/>
        <VisualItems key={key} items={items} onChange={setItems} mobile={device !== 'desktop'} more={area === 'extra'} library={library}/>
        <button type="button" className="btn-ghost text-xs" onClick={() => update({ [key]: JSON.stringify(fallback), ...(device === 'desktop' ? { nav_desktop_customized: 'true' } : {}) })}>Восстановить стандартные пункты</button>
    </div>;
}
