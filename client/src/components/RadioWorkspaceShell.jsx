import {useEffect,useState} from 'react';

export const RADIO_NAV_GROUPS=[
 {id:'broadcast',title:'Эфир',items:[
  {id:'home',icon:'◉',label:'Эфирный центр',hint:'Сейчас в эфире · управление'},
  {id:'studio',icon:'◉',label:'Студия',hint:'Микрофон · прямой эфир'}]},
 {id:'planning',title:'Планирование',items:[
  {id:'schedule',icon:'▦',label:'Сетка вещания',hint:'Календарь и передачи'}]},
 {id:'music',title:'Музыка и плейлисты',items:[
  {id:'playlists',icon:'☷',label:'Плейлисты',hint:'Подготовка передач'},
  {id:'auto-playlists',icon:'♫',label:'Автоплейлисты',hint:'Генерация и редактор'},
  {id:'assets',icon:'♫',label:'Аудиотека',hint:'Треки и джинглы'}]},
 {id:'settings',title:'Автоматизация и звук',items:[
  {id:'automation',icon:'⟳',label:'Автоматизация',hint:'AutoDJ · ротация'},
  {id:'processing',icon:'≋',label:'Звук',hint:'Обработка и переходы'}]},
 {id:'monitor',title:'Мониторинг',items:[
  {id:'history',icon:'◷',label:'История',hint:'Отчёты · эфирные события'},
  {id:'equipment',icon:'▣',label:'Оборудование',hint:'Радиокомпьютеры'}]}
];
const items=RADIO_NAV_GROUPS.flatMap(group=>group.items);
export const RADIO_WORKSPACE_TABS=items.map(i=>i.id);
const quick=[
 {id:'home',label:'Эфир',icon:'◉'},
 {id:'schedule',label:'Сетка',icon:'▦'},
 {id:'playlists',label:'Плейлисты',icon:'☷'},
 {id:'assets',label:'Аудиотека',icon:'♫'},
 {id:'automation',label:'Автоматика',icon:'⟳'}
];

export function RadioWorkspaceShell({tab,onSelect,children,stats}){
 const [compact,setCompact]=useState(false);
 const [mobileOpen,setMobileOpen]=useState(false);
 const [expanded,setExpanded]=useState({});
 useEffect(()=>{setMobileOpen(false);},[tab]);
 useEffect(()=>{
  const shortcut=event=>{
   if(!event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!/^([1-9])$/.test(event.key))return;
   if(event.target instanceof HTMLElement&&
     (event.target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)))return;
   const item=items[Number(event.key)-1];
   if(item){event.preventDefault();onSelect(item.id);}
  };
  window.addEventListener('keydown',shortcut);
  return()=>window.removeEventListener('keydown',shortcut);
 },[onSelect]);
 const current=items.find(x=>x.id===tab)||items[0];
 const activeGroup=RADIO_NAV_GROUPS.find(g=>g.items.some(i=>i.id===tab));
 const nav=<nav aria-label="Разделы радиостанции" className="space-y-4 p-3">
  {RADIO_NAV_GROUPS.map(group=><section key={group.id} aria-label={group.title} className="space-y-1">
   <button type="button" onClick={()=>setExpanded(v=>({...v,[group.id]:!(v[group.id]??group.id===activeGroup?.id)}))}
    aria-expanded={expanded[group.id]??group.id===activeGroup?.id}
    className={'radio-nav-group w-full rounded-lg px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider opacity-65 hover:opacity-100 '+(compact?'lg:text-center':'')}>
    <span className={compact?'lg:hidden':''}>{group.title}</span><span className={compact?'hidden lg:inline':'hidden'}>•••</span>
   </button>
   {(expanded[group.id]??group.id===activeGroup?.id)&&group.items.map(item=>
    <button key={item.id} type="button" onClick={()=>onSelect(item.id)}
     title={item.hint} aria-current={tab===item.id?'page':undefined}
     className={'radio-nav-item flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors '+(tab===item.id?'radio-nav-item-active':'hover:bg-black/5 dark:hover:bg-white/10')}>
     <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-current/15">{item.icon}</span>
     <span className={'min-w-0 '+(compact?'lg:hidden':'')}><span className="block text-sm font-semibold">{item.label}</span>
      <span className="block text-[11px] opacity-65">{item.hint}</span></span>
    </button>)}
  </section>)}
  <button type="button" className="hidden lg:block w-full rounded-xl border border-current/15 p-2 text-xs"
   onClick={()=>setCompact(v=>!v)}>{compact?'→':'← Свернуть меню'}</button>
 </nav>;
 return <div className="radio-workspace radio-v3 min-h-[calc(100vh-6rem)] text-slate-950 dark:text-slate-100">
  <div className="radio-shell relative overflow-hidden rounded-3xl shadow-sm">
   <header className="radio-shell-header radio-v3-header sticky top-0 z-30 flex items-center gap-3 border-b p-3 backdrop-blur-xl sm:px-5">
    <button type="button" onClick={()=>setMobileOpen(v=>!v)} aria-label="Разделы радио"
     aria-expanded={mobileOpen} className="lg:hidden grid h-10 w-10 place-items-center rounded-xl border border-current/15">☰</button>
    <button type="button" onClick={()=>onSelect('home')} title="На эфирный центр"
     className="grid h-10 w-10 place-items-center rounded-xl bg-violet-700 font-black text-white">R</button>
    <div className="min-w-0 flex-1">
     <p className="text-[10px] font-bold uppercase tracking-[.15em] opacity-55">MEDIA · РАФ · RAW / ПОЛИТЕХ-FM</p>
     <p className="truncate font-bold text-base">{current.label}</p>
    </div>
    <div className="hidden xl:flex items-center gap-2 text-xs">
     <span className="rounded-full border border-current/15 px-3 py-1.5">{stats?.assets??0} аудиозаписей</span>
     <span className="rounded-full border border-current/15 px-3 py-1.5">{stats?.playlists??0} плейлистов</span>
     <span className="rounded-full border border-current/15 px-3 py-1.5">{stats?.slots??0} событий</span>
    </div>
    <button type="button" onClick={()=>onSelect('schedule')} className="hidden rounded-xl bg-violet-700 px-3 py-2 text-xs font-semibold text-white sm:block">Сетка эфира ↗</button>
   </header>
   <div className="flex min-w-0">
    {mobileOpen&&<button type="button" aria-label="Закрыть меню" className="absolute inset-0 z-30 bg-black/50 lg:hidden" onClick={()=>setMobileOpen(false)}/>}
    <aside className={'radio-sidebar radio-v3-sidebar absolute z-40 shrink-0 border-r lg:static lg:block '+(mobileOpen?'block':'hidden')+' w-[min(85vw,310px)] '+(compact?'lg:w-[84px]':'lg:w-[250px]')}>
     {nav}
    </aside>
    <main className="min-w-0 flex-1 space-y-5 p-3 pb-24 sm:p-5 sm:pb-6 lg:p-6">
     <div className="radio-v3-context flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider opacity-50">{activeGroup?.title||'Радиостанция'}</p>
       <h1 className="text-lg font-bold sm:text-xl">{current.label}</h1></div>
      <div className="flex flex-wrap gap-2">
       <button type="button" onClick={()=>onSelect('home')} className="rounded-xl border border-current/15 px-3 py-2 text-xs">Сейчас в эфире</button>
       <button type="button" onClick={()=>onSelect('auto-playlists')} className="rounded-xl border border-current/15 px-3 py-2 text-xs">Автоплейлисты</button>
      </div>
     </div>
     {children}
    </main>
   </div>
   <nav aria-label="Быстрый переход по радио" className="radio-v3-bottom fixed inset-x-2 bottom-2 z-20 flex justify-around rounded-2xl border border-current/15 p-1.5 shadow-2xl backdrop-blur-2xl lg:hidden">
    {quick.map(item=><button key={item.id} type="button" onClick={()=>onSelect(item.id)}
     aria-current={tab===item.id?'page':undefined} className={'min-w-0 flex-1 rounded-xl p-2 text-center '+(tab===item.id?'radio-nav-item-active':'')}>
     <span aria-hidden="true" className="block text-lg">{item.icon}</span><span className="block truncate text-[10px]">{item.label}</span>
    </button>)}
   </nav>
  </div>
 </div>;
}
