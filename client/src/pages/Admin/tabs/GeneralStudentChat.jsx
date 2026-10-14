import {useCallback,useEffect,useState} from 'react';
import {api} from '../../../api/client.js';

export default function GeneralStudentChat({token}){
 const [data,setData]=useState(null),[chatId,setChatId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [memberQuery,setMemberQuery]=useState(''),[users,setUsers]=useState([]),[searchOpen,setSearchOpen]=useState(false),[searchBusy,setSearchBusy]=useState(false);
 const [memberBusy,setMemberBusy]=useState(false);
 useEffect(()=>{
  const query=memberQuery.trim();
  if(query.length<2){setUsers([]);setSearchBusy(false);return;}
  let active=true;
  const timer=setTimeout(async()=>{
   setSearchBusy(true);
   try{
    const result=await api('/admin/general-student-chat/users?q='+encodeURIComponent(query),{token});
    if(active)setUsers(result.users||[]);
   }catch(e){if(active)setError(e.message||'Ошибка поиска пользователей');}
   finally{if(active)setSearchBusy(false);}
  },250);
  return()=>{active=false;clearTimeout(timer);};
 },[token,memberQuery]);
 const addMember=async user=>{
  if(!chatId||!user?.id)return;
  setMemberBusy(true);setError('');setNotice('');
  try{
   const result=await api('/admin/general-student-chat/members',{
    method:'POST',token,body:{chatId,userId:user.id},
   });
   setNotice(result.added?`${user.fullName||user.username} добавлен(а) в выбранный чат.`:'Этот пользователь уже состоит в чате.');
   setMemberQuery('');setUsers([]);setSearchOpen(false);await load();
  }catch(e){setError(e.message||'Не удалось добавить участника');}
  finally{setMemberBusy(false);}
 };
 const load=useCallback(async()=>{
   setBusy(true);setError('');
   try{const result=await api('/admin/general-student-chat',{token});setData(result);setChatId(result.chatId||'');}
   catch(e){setError(e.message||'Ошибка загрузки');}finally{setBusy(false);}
 },[token]);
 useEffect(()=>{load();},[load]);
 const action=async mode=>{
   setBusy(true);setError('');setNotice('');
   try{const result=await api('/admin/general-student-chat'+(mode==='sync'?'/sync':''),{
     method:mode==='sync'?'POST':'PUT',token,body:mode==='sync'?{}:{chatId}});
     setNotice(`Синхронизация выполнена: добавлено ${result.added} из ${result.eligible} студентов. Уже состояли: ${result.alreadyPresent}.`);
     await load();
   }catch(e){setError(e.message||'Синхронизация не выполнена');}
   finally{setBusy(false);}
 };
 return <div className="max-w-3xl space-y-4">
  <header><h2 className="text-2xl font-bold">Общий чат медиацентра</h2>
   <p className="text-sm text-slate-600 dark:text-white/70 mt-2">Все активные пользователи с ролью «Студент» должны находиться в одном выбранном групповом чате. Новые участники добавляются при регистрации, пропущенных можно синхронизировать вручную.</p></header>
  {error&&<p role="alert" className="rounded-xl border border-red-400 p-3 text-red-700 dark:text-red-300">{error}</p>}
  {notice&&<p role="status" className="rounded-xl border border-emerald-400 p-3 text-emerald-800 dark:text-emerald-300">{notice}</p>}
  <div className="grid sm:grid-cols-3 gap-3">
   {[[data?.studentCount,'Активных студентов'],[data?.currentStudents,'В общем чате'],[data?.missing,'Нужно добавить']].map(([value,label])=>
    <div key={label} className="card p-4"><div className="text-2xl font-bold">{value??'—'}</div><div className="text-xs text-slate-600 dark:text-white/70">{label}</div></div>)}
  </div>
  <div className="card p-5 space-y-4">
    <label className="block text-sm font-semibold">Групповой чат медиацентра
     <select className="input w-full mt-2" value={chatId} disabled={busy} onChange={e=>setChatId(e.target.value)}>
      <option value="">Выберите существующий чат</option>
      {(data?.chats||[]).map(c=><option key={c.id} value={c.id}>{c.title} · {c.members} участников</option>)}
     </select>
    </label>
    <p className="text-xs text-slate-600 dark:text-white/60">Выбор сохраняется в настройках платформы. Существующие сообщения и другие групповые чаты не меняются.</p>
    <div className="flex flex-wrap gap-2">
     <button className="btn-primary min-h-11" disabled={busy||!chatId} onClick={()=>action('save')}>Сохранить и добавить студентов</button>
     <button className="btn-ghost min-h-11" disabled={busy||!data?.configured} onClick={()=>action('sync')}>Синхронизировать участников</button>
     <button className="btn-ghost min-h-11" disabled={busy} onClick={load}>Обновить</button>
    </div>
  </div>
  <section className="card p-5 space-y-4">
   <div><h3 className="text-lg font-bold">Добавить участника вручную</h3>
    <p className="text-sm text-slate-600 dark:text-white/70 mt-1">Можно добавить любого зарегистрированного незаблокированного пользователя, включая наставников и администраторов. Выберите чат выше — автоматические правила для студентов останутся без изменений.</p></div>
   <div className="relative">
    <label htmlFor="general-chat-member-search" className="block text-sm font-semibold mb-2">Поиск участника</label>
    <div className="relative">
     <input id="general-chat-member-search" className="input w-full pr-10" role="combobox"
      aria-autocomplete="list" aria-expanded={searchOpen&&memberQuery.trim().length>=2}
      aria-controls="general-chat-member-results" autoComplete="off"
      value={memberQuery} disabled={busy||memberBusy||!chatId}
      onChange={e=>{setMemberQuery(e.target.value);setSearchOpen(true);}}
      onFocus={()=>setSearchOpen(true)}
      onKeyDown={e=>{if(e.key==='Escape')setSearchOpen(false);}}
      placeholder={chatId?"Введите имя или @логин (от 2 символов)":"Сначала выберите групповой чат"}/>
     {searchBusy&&<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 dark:text-white/60">Поиск…</span>}
    </div>
    {searchOpen&&memberQuery.trim().length>=2&&<div id="general-chat-member-results" role="listbox"
      className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/20 bg-white dark:bg-slate-900 shadow-xl">
      {!searchBusy&&users.length===0&&<p className="px-4 py-3 text-sm text-slate-600 dark:text-white/70">Пользователи не найдены</p>}
      {users.map(user=><button key={user.id} type="button" role="option" aria-selected={false}
       disabled={memberBusy}
       className="block w-full px-4 py-3 text-left hover:bg-violet-50 dark:hover:bg-white/10 focus:bg-violet-50 dark:focus:bg-white/10 border-b last:border-b-0 border-slate-100 dark:border-white/10"
       onClick={()=>addMember(user)}>
        <span className="block font-medium text-sm text-slate-900 dark:text-white">{user.fullName||user.username}</span>
        <span className="block text-xs text-slate-600 dark:text-white/65">@{user.username} · {user.role}</span>
      </button>)}
     </div>}
    <p className="mt-2 text-xs text-slate-600 dark:text-white/60">Найдите человека и нажмите на результат — он сразу добавится в выбранный чат.</p>
   </div>
   {!data?.chats?.length&&<p className="text-sm text-amber-800 dark:text-amber-200">Сначала создайте групповой чат.</p>}
  </section>
 </div>;
}
