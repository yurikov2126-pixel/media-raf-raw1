import {useEffect,useState} from 'react';
const items=[
 {id:'home',icon:'◉',label:'Эфирный пульт',hint:'Сейчас играет · состояние'},
 {id:'studio',icon:'◉',label:'Студия',hint:'Микрофон · прослушивание'},
 {id:'schedule',icon:'▦',label:'Сетка вещания',hint:'Календарь программ'},
 {id:'playlists',icon:'☷',label:'Плейлисты',hint:'Подготовка программ'},
 {id:'auto-playlists',icon:'♫',label:'Автоплейлисты',hint:'Генерация музыки · джинглы'},
 {id:'assets',icon:'♫',label:'Аудиотека',hint:'Записи · загрузки'},
 {id:'automation',icon:'⟳',label:'Автоматизация',hint:'Auto-DJ · ротация · джинглы'},
 {id:'processing',icon:'≋',label:'Звук',hint:'Обработка · метки · переходы'},
 {id:'history',icon:'◷',label:'История',hint:'Отчёты · события'},
 {id:'equipment',icon:'▣',label:'Оборудование',hint:'Радиокомпьютеры'},
];
export const RADIO_WORKSPACE_TABS=items.map(i=>i.id);
export function RadioWorkspaceShell({tab,onSelect,children,stats}){
 const [compact,setCompact]=useState(false);
 const [mobileOpen,setMobileOpen]=useState(false);
 useEffect(()=>{setMobileOpen(false);},[tab]);
 useEffect(()=>{
  const keydown=event=>{
   if(!event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!/^([1-9])$/.test(event.key))return;
   const target=event.target;
   if(target instanceof HTMLElement && (target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target.tagName)))return;
   const item=items[Number(event.key)-1];
   if(item){event.preventDefault();onSelect(item.id);}
  };
  window.addEventListener('keydown',keydown);
  return()=>window.removeEventListener('keydown',keydown);
 },[onSelect]);
 const current=items.find(x=>x.id===tab)||items[0];
 return <div className="radio-workspace min-h-[calc(100vh-6rem)] text-slate-950 dark:text-slate-100">
  <div className="radio-shell relative overflow-hidden rounded-3xl shadow-sm">
   <header className="radio-shell-header sticky top-0 z-20 flex items-center gap-3 border-b p-3 sm:p-4 backdrop-blur-xl">
    <button type="button" onClick={()=>setMobileOpen(v=>!v)} aria-label="Разделы радио" aria-expanded={mobileOpen}
      className="lg:hidden rounded-xl border border-current/15 px-3 py-2 text-lg">☰</button>
    <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-700 font-black text-white">R</span>
    <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.18em] opacity-55">MEDIA · РАФ · RAW / RADIO</p>
     <p className="truncate font-bold text-base sm:text-lg">{current.label}</p></div>
    <div className="hidden sm:flex flex-wrap items-center gap-2 text-[11px]">
     <span className="rounded-full border border-current/10 px-3 py-1.5">{stats.assets} записей</span>
     <span className="rounded-full border border-current/10 px-3 py-1.5">{stats.playlists} плейлистов</span>
     <span className="rounded-full border border-current/10 px-3 py-1.5">{stats.slots} событий</span>
    </div>
   </header>
   <div className="flex min-w-0">
    {mobileOpen&&<button type="button" aria-label="Закрыть меню разделов" className="absolute inset-0 z-10 bg-black/25 lg:hidden" onClick={()=>setMobileOpen(false)}/>}
    <aside className={`radio-sidebar ${mobileOpen?'block':'hidden'} absolute z-20 w-72 border-r lg:static lg:block ${compact?'lg:w-20':'lg:w-60'} shrink-0 transition-all`}>
     <nav aria-label="Разделы радиостанции" className="sticky top-20 space-y-1 p-3">
      {items.map(item=><button key={item.id} type="button" onClick={()=>onSelect(item.id)} title={item.hint+' · Alt+'+(items.indexOf(item)+1)}
        aria-current={tab===item.id?'page':undefined} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${tab===item.id?'bg-violet-700 text-white shadow-md':'hover:bg-black/5 dark:hover:bg-white/10'}`}>
       <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-current/15 text-lg">{item.icon}</span>
       {!compact&&<span className="min-w-0"><span className="block text-sm font-semibold">{item.label}</span><span className={`block text-[11px] ${tab===item.id?'text-white/70':'opacity-60'}`}>{item.hint}</span></span>}
      </button>)}
      <button type="button" onClick={()=>setCompact(v=>!v)} className="hidden lg:block w-full rounded-lg px-3 py-2 text-xs opacity-55 hover:opacity-100">
       {compact?'Развернуть меню →':'← Свернуть меню'}
      </button>
     </nav>
    </aside>
    <main className="min-w-0 flex-1 p-3 sm:p-5 lg:p-6 space-y-5">
     <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-[11px] uppercase tracking-wider opacity-50">Рабочее пространство</p>
      <h1 className="text-xl sm:text-2xl font-bold">{current.label}</h1><p className="text-xs opacity-60">{current.hint}</p></div>

     </div>
     {children}
    </main>
   </div>
  </div>
 </div>;
}
