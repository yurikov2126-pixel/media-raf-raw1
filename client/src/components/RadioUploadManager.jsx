import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '../store/auth.jsx';

const Context = createContext(null);
const API = import.meta.env.VITE_API || 'http://localhost:4000/api';
export const useRadioUploads = () => useContext(Context);
const kinds = /\.(mp3|wav|ogg|flac|m4a)$/i;
const limit = 30*1024*1024;

export function RadioUploadProvider({ children }) {
  const { token, user } = useAuth();
  const [tasks,setTasks] = useState([]);
  const [minimized,setMinimized] = useState(false);
  const [visible,setVisible] = useState(false);
  const queue = useRef([]);
  const working = useRef(false);
  const session = useRef(user?.id);
  const xhrRef = useRef(null);
  useEffect(() => {
    if(session.current !== user?.id){ xhrRef.current?.abort(); queue.current=[]; session.current=user?.id; setTasks([]);setVisible(false); }
  },[user?.id]);
  const patch = (id,delta) => setTasks(current=>current.map(t=>t.id===id?{...t,...delta}:t));
  const pump = async () => {
    if(working.current)return;
    working.current=true;
    while(queue.current.length){
      const task=queue.current.shift();
      if(task.file.size>limit||!kinds.test(task.file.name)){patch(task.id,{status:'error',error:'Файл не поддерживается или больше 30 МБ'});continue;}
      patch(task.id,{status:'uploading'});
      await new Promise(resolve=>{
        const xhr=new XMLHttpRequest();
        xhrRef.current=xhr;
        xhr.open('POST', API+(task.student?'/radio/student/assets':'/radio/assets'));
        xhr.setRequestHeader('Authorization','Bearer '+task.token);
        xhr.upload.onprogress=e=>{if(e.lengthComputable)patch(task.id,{progress:Math.min(99,Math.round(e.loaded/e.total*100))});};
        xhr.onerror=()=>{patch(task.id,{status:'error',error:'Ошибка сети'});resolve();};
        xhr.onabort=()=>{patch(task.id,{status:'error',error:'Загрузка прервана'});resolve();};
        xhr.onload=()=>{
          if(xhr.status>=200&&xhr.status<300){patch(task.id,{status:'done',progress:100});}
          else{let error='HTTP '+xhr.status;try{error=JSON.parse(xhr.responseText).error||error;}catch{}patch(task.id,{status:'error',error});}
          resolve();
        };
        const form=new FormData();form.append('file',task.file);form.append('filename',task.file.name);
        xhr.send(form);
      });
      xhrRef.current=null;
    }
    working.current=false;
  };
  const addFiles = (files, student=false) => {
    if(!token)return;
    const list=Array.from(files||[]);
    if(!list.length)return;
    const now=Date.now();
    const queued=list.map((file,i)=>({id:now+'-'+i+'-'+Math.random().toString(36).slice(2),file,student,token,name:file.name,progress:0,status:'queued'}));
    setTasks(previous=>[...previous,...queued]);
    queue.current.push(...queued);
    setVisible(true);setMinimized(false);
    void pump();
  };
  const total=tasks.length;
  const completed=tasks.filter(t=>t.status==='done'||t.status==='error').length;
  const progress=total?Math.round(tasks.reduce((n,t)=>n+t.progress,0)/total):0;
  const running=tasks.some(t=>t.status==='queued'||t.status==='uploading');
  const close=()=>{if(running){setMinimized(true);}else{setVisible(false);}};
  return <Context.Provider value={{addFiles,tasks,running}}>
    {children}
    {visible&&<div className={minimized?'fixed bottom-20 right-3 z-[250] w-[min(340px,calc(100vw-24px))]':'fixed inset-0 z-[250] flex items-center justify-center bg-black/60 p-3'} data-no-route-swipe>
      <section role="dialog" aria-label="Загрузка аудиофайлов" className="max-h-[85vh] w-full overflow-hidden rounded-2xl border border-current/20 bg-slate-100 p-4 text-slate-950 shadow-2xl dark:bg-slate-900 dark:text-white">
        <div className="flex items-center justify-between gap-3"><strong>Загрузка аудио · {completed}/{total}</strong>
          <button type="button" className="rounded-lg border border-current/20 px-3 py-2 text-xs" onClick={()=>minimized?setMinimized(false):close()}>{minimized?'Развернуть':running?'Свернуть':'Закрыть'}</button></div>
        <progress className="my-2 w-full accent-blue-600" max="100" value={progress}/>
        <p className="text-xs opacity-65">Общий прогресс: {progress}%{running?' · передача продолжается':''}</p>
        {!minimized&&<div className="mt-3 max-h-[55vh] space-y-2 overflow-auto">
          {tasks.map(t=><div key={t.id} className="rounded-xl border border-current/15 p-2 text-xs">
            <div className="flex justify-between gap-2"><span className="min-w-0 truncate">{t.name}</span><span>{t.status==='done'?'Готово':t.status==='error'?'Ошибка':t.progress+'%'}</span></div>
            <progress className="mt-1 w-full accent-blue-600" max="100" value={t.progress}/>
            {t.error&&<p className="text-red-600 dark:text-red-400">{t.error}</p>}
          </div>)}
        </div>}
      </section>
    </div>}
  </Context.Provider>;
}
