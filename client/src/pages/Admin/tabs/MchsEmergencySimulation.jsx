import MchsWorkerServerSession from './MchsWorkerServerSession.jsx';

export default function MchsEmergencySimulation({token}){
 return <section className="mchs-panel rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 p-4 sm:p-5 space-y-4">
  <div className="space-y-1">
   <h3 className="text-lg font-semibold">Управление учебной сессией МЧС</h3>
   <p className="text-sm text-slate-600 dark:text-slate-300">Серверная учебная сессия. Эти команды сами по себе не включают усилитель и не разрешают подачу сигнала в систему оповещения.</p>
  </div>
  <MchsWorkerServerSession token={token}/>
 </section>;
}
