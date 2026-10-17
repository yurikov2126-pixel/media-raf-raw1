import { useEffect, useState } from 'react';
import { useAuth } from '../store/auth.jsx';
import { api } from '../api/client.js';

const SECTIONS = [
  ['Сетка вещания', 'Единое расписание радиопрограмм и управления усилителем'],
  ['Плейлисты', 'Подготовка и согласование радиопередач'],
  ['Эфирная студия', 'Прямые трансляции с мобильных устройств'],
  ['Оборудование', 'Windows Radio Agent, ESP32, усилитель AA-300'],
  ['История эфира', 'Отчёты о воспроизведении и событиях'],
];

export default function Radio() {
  const { token } = useAuth();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api('/radio/status', { token }).then(data => {
      if (active) setStatus(data);
    }).catch(() => { if (active) setError('Статус радиомодуля пока недоступен'); });
    return () => { active = false; };
  }, [token]);
  return (
    <main className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest opacity-60">MEDIA · РАФ · RAW</p>
        <h1 className="text-3xl font-bold">Радио</h1>
        <p className="opacity-70">Центр управления радиовещанием колледжа</p>
      </header>
      <section className="rounded-2xl border border-current/10 bg-white/5 p-5 space-y-2" aria-live="polite">
        <div className="flex justify-between gap-3 items-center flex-wrap">
          <h2 className="font-semibold">Эфирная система</h2>
          <span className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-300 px-3 py-1 text-xs font-medium">Настройка</span>
        </div>
        <p className="text-sm opacity-70">{error || (status ? 'Радиомодуль подключён. Воспроизведение и управление оборудованием ещё не активированы.' : 'Подключение к радиомодулю…')}</p>
      </section>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SECTIONS.map(([title, description]) => (
          <section key={title} className="rounded-2xl border border-current/10 bg-white/5 p-5 space-y-2">
            <h2 className="font-semibold">{title}</h2>
            <p className="text-sm opacity-70">{description}</p>
            <p className="text-xs opacity-50">В разработке</p>
          </section>
        ))}
      </div>
    </main>
  );
}
