import {useCallback,useEffect,useState} from 'react';
import {api} from '../../../api/client.js';

export default function GeneralStudentChat({token}){
 const [data,setData]=useState(null),[chatId,setChatId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
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
 </div>;
}
