/** Shared headline + data summary for each radio production tool. */
export default function RadioSectionIntro({eyebrow='RADIO / WORKSPACE',title,description,metrics=[]}){
 return <header className="relative overflow-hidden rounded-2xl border border-current/10 bg-gradient-to-r from-indigo-500/10 via-white/70 to-white/40 p-4 dark:from-indigo-400/10 dark:via-slate-900/60 dark:to-slate-900/30 sm:p-5">
  <p className="text-[10px] font-bold uppercase tracking-[.16em] text-indigo-700 dark:text-indigo-300">{eyebrow}</p>
  <h2 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
  <p className="mt-2 max-w-3xl text-sm leading-relaxed opacity-70">{description}</p>
  {metrics.length>0&&<div className="mt-5 flex flex-wrap gap-2">
   {metrics.map(item=><div key={item.label} className="min-w-24 rounded-xl border border-current/10 bg-white/50 px-3 py-2 dark:bg-slate-900/55">
    <span className="block text-[10px] uppercase tracking-wider opacity-55">{item.label}</span>
    <strong className="mt-1 block text-lg tabular-nums">{item.value}</strong>
   </div>)}
  </div>}
 </header>;
}
