import { useState } from 'react';
import Icon, { ICON_NAMES } from '../../../../components/Icon.jsx';

const LABELS = { home:'Дом',dashboard:'Главная',feed:'Лента',search:'Поиск',plus:'Добавить',message:'Сообщения',book:'Обучение',bell:'Уведомления',user:'Профиль',users:'Команда',more:'Ещё',trophy:'Награды',settings:'Настройки',sun:'Солнце',moon:'Луна',command:'Команда',arrowRight:'Стрелка',check:'Галочка',chevronRight:'Вправо',chevronDown:'Вниз',sparkles:'Искры',newspaper:'Редакция',calendar:'Календарь',clock:'Время',zap:'Молния',logOut:'Выход',x:'Закрыть',sliders:'Параметры',layers:'Слои',panel:'Панель' };
export default function IconPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const options = ICON_NAMES.filter(name => name.toLowerCase().includes(query.toLowerCase()) || (LABELS[name] || '').toLowerCase().includes(query.toLowerCase()));
  return <div className="relative">
    <button type="button" className="input !py-2 flex items-center gap-2 w-full" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-label="Выбрать иконку">
      <Icon name={value} size={20}/><span className="text-sm truncate">{LABELS[value] || value || 'Выбрать'}</span><span className="ml-auto">▾</span>
    </button>
    {open && <div className="mt-2 rounded-xl border border-white/20 bg-ink-800 p-3 space-y-3">
      <label className="sr-only" htmlFor="icon-picker-search">Поиск иконки</label>
      <input id="icon-picker-search" className="input !py-2" placeholder="Найти иконку…" value={query} onChange={e => setQuery(e.target.value)} />
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
        {options.map(name => <button type="button" key={name} title={name} aria-label={LABELS[name] || name} aria-pressed={name === value} onClick={() => { onChange(name); setOpen(false); }} className={`rounded-lg border p-2 flex flex-col items-center gap-1 text-xs ${name === value ? 'border-violet bg-violet/20' : 'border-white/10 hover:bg-white/10'}`}><Icon name={name} size={23}/><span className="truncate max-w-full">{LABELS[name] || name}</span></button>)}
      </div>
      {options.length === 0 && <p className="text-xs opacity-60">Иконки не найдены</p>}
      <button type="button" className="btn-ghost text-xs" onClick={() => setOpen(false)}>Закрыть</button>
    </div>}
  </div>;
}
