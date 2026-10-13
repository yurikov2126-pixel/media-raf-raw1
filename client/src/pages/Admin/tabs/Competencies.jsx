import { useEffect, useState } from 'react';
import { api } from '../../../api/client.js';

export default function Competencies({ token }) {
    const [items,setItems]=useState([]);
    const [name,setName]=useState('');
    const [description,setDescription]=useState('');
    const [error,setError]=useState('');
    const [busy,setBusy]=useState(false);
    const refresh=()=>api('/competencies',{token}).then(setItems).catch(e=>setError(e.message));
    useEffect(()=>{refresh();},[token]);
    const add=async e=>{e.preventDefault();setBusy(true);setError('');
        try{await api('/competencies',{token,method:'POST',body:{name,description}});setName('');setDescription('');await refresh();}
        catch(e){setError(e.message);}finally{setBusy(false);}
    };
    const update=async (id,change)=>{setError('');try{await api('/competencies/'+id,{token,method:'PATCH',body:change});await refresh();}catch(e){setError(e.message);}};
    return <section className="space-y-5">
        <header><h2 className="text-xl font-bold">Компетенции студентов</h2><p className="text-sm opacity-65 mt-1">Привязывайте компетенции к курсам. После выдачи сертификата они подтверждаются автоматически. Отключённые навыки останутся в истории.</p></header>
        {error&&<p role="alert" className="rounded-lg p-3 bg-red-500/10 text-red-300">{error}</p>}
        <form onSubmit={add} className="card p-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Название<input required maxLength={100} className="input mt-1 w-full" value={name} onChange={e=>setName(e.target.value)} placeholder="Например, Репортажная фотография"/></label>
            <label className="text-sm">Описание<input maxLength={500} className="input mt-1 w-full" value={description} onChange={e=>setDescription(e.target.value)}/></label>
            <button disabled={busy} className="btn-primary sm:col-span-2 min-h-11">{busy?'Добавляем…':'+ Добавить компетенцию'}</button>
        </form>
        <div className="grid gap-3">{items.map(item=><article key={item.id} className="card p-4 flex flex-wrap gap-3 items-center justify-between">
            <div className="min-w-0 flex-1"><div className="font-semibold">{item.name}</div><p className="text-xs opacity-65 mt-1">{item.description || 'Без описания'}</p><span className="text-xs opacity-60">{item.active?'Активна':'Отключена'}</span></div>
            <div className="flex flex-wrap gap-2">
                <button className="btn-ghost text-sm" onClick={()=>{const value=window.prompt('Название компетенции',item.name);if(value!==null&&value.trim())update(item.id,{name:value.trim()});}}>Переименовать</button>
                <button className="btn-ghost text-sm" onClick={()=>update(item.id,{active:!item.active})}>{item.active?'Отключить':'Включить'}</button>
            </div>
        </article>)}</div>
        {!items.length&&<p className="text-sm opacity-65">Компетенций пока нет.</p>}
    </section>;
}
