import Icon from '../../../../components/Icon.jsx';

export default function MenuPreview({ device, primary, extra, settings }) {
  const desktop = device === 'desktop';
  const visible = list => list.filter(item => item && (item.action === 'more' || (typeof item.to === 'string' && item.to.startsWith('/app'))));
  const items = visible(primary);
  return <section className="rounded-2xl border border-white/15 overflow-hidden" aria-label="Предпросмотр меню">
    <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center gap-2">
      <div><h4 className="font-semibold text-sm">Предпросмотр навигации</h4><p className="text-xs text-white/50">Обновляется при редактировании · без сохранения</p></div>
      <span className="text-xs opacity-60">{desktop ? 'ПК' : device === 'pwa' ? 'PWA' : 'Мобильный браузер'}</span>
    </div>
    <div className="bg-[#10101d] p-4 overflow-x-auto">
      {desktop ? <div className="flex rounded-xl border border-white/10 overflow-hidden min-h-[300px]">
        <aside className="w-52 shrink-0 bg-[#1b1a2b] p-3 space-y-2">
          <div className="font-bold text-sm px-2 pb-3 border-b border-white/10">{settings.brand_logo_text || settings.site_name || 'MEDIA·RAF·RAW'}</div>
          {items.map((item,i) => <div key={i} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${i===0?'bg-violet/25 text-white':'text-white/70'}`}><Icon name={item.icon} size={19}/><span className="truncate">{item.label}</span></div>)}
        </aside>
        <div className="flex-1 p-5"><div className="text-lg font-semibold">Главная</div><p className="text-xs opacity-50 mt-2">Рабочая область сайта</p><div className="mt-5 h-24 rounded-xl border border-white/10 bg-white/5"/></div>
      </div> : <div className="mx-auto max-w-[390px] rounded-[24px] border-4 border-white/15 overflow-hidden bg-[#171725] min-h-[340px] flex flex-col">
        <div className="flex justify-between px-4 py-3 border-b border-white/10"><strong className="text-sm">MEDIA·RAF·RAW</strong><span className="text-xs opacity-60">● ● ●</span></div>
        <div className="flex-1 p-5"><div className="font-bold">Главная</div><div className="mt-4 rounded-xl h-24 bg-white/5 border border-white/10"/></div>
        <nav className="grid gap-1 p-2 border-t border-white/10" style={{gridTemplateColumns:`repeat(${Math.max(1,Math.min(items.length,5))},minmax(0,1fr))`}}>
          {items.slice(0,5).map((item,i)=><div key={i} className="flex flex-col items-center justify-center gap-1 min-w-0 text-white/80"><Icon name={item.icon} size={21}/><span className="text-[10px] truncate max-w-full">{item.label}</span></div>)}
        </nav>
      </div>}
      {!desktop && <div className="mt-3 rounded-xl border border-white/10 bg-[#1b1a2b] p-3"><div className="text-xs opacity-60 mb-3">Содержимое меню «Ещё»</div><div className="grid grid-cols-3 sm:grid-cols-4 gap-3">{visible(extra).map((item,i)=><div key={i} className="flex flex-col items-center gap-1 text-center"><Icon name={item.icon} size={22}/><span className="text-xs break-words">{item.label}</span></div>)}</div></div>}
    </div>
    <p className="px-4 py-2 text-xs text-white/50">Макет показывает порядок, названия и иконки. Доступность пунктов на сайте зависит от роли и включённых модулей.</p>
  </section>;
}
