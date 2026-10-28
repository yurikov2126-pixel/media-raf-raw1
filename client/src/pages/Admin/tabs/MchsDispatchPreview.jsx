import { useEffect, useState } from 'react';
import { api } from '../../../api/client.js';

const reasonLabels = {
  DUPLICATE: 'Повторная запись',
  UNCLASSIFIED: 'Не распознано',
  STALE_OR_UNKNOWN_TIME: 'Время события не подтверждено или сообщение старше 2 минут',
  RULE_DISABLED: 'Реакция отключена в шаблоне',
  ALARM_AUDIO_MISSING: 'Нет доступной аудиозаписи ALARM',
  REGION_UNVERIFIED: 'Регион не подтверждён',
};
export default function MchsDispatchPreview({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const refresh = async () => {
    setLoading(true);
    try { setData(await api('/safety/dispatch-preview', { token })); setError(''); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let active = true;
    api('/safety/dispatch-preview', { token }).then(result => { if (active) setData(result); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [token]);
  return <section className="rounded-2xl border border-slate-200 p-4 dark:border-white/10 md:p-5 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold text-lg">Проверка решений — без эфира</h3>
      <button type="button" disabled={loading} onClick={refresh} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-white/20">{loading ? 'Проверяем…' : 'Проверить сейчас'}</button>
    </div>
    <p className="text-sm opacity-70">Предпросмотр последних 100 событий по выбранным правилам. Ничего не воспроизводит и не меняет. Даже статус «Готово к проверке» не подтверждает подлинность уведомления.</p>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {data && <p className="text-sm opacity-65">Проверено записей: {data.evaluatedCount}. Вещание: выключено.</p>}
    <div className="space-y-2">{data?.decisions?.slice(0,20).map(item => <div key={item.eventId} className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
      <div className="flex flex-wrap gap-2 items-center text-xs">
        <strong>{item.eventType}</strong>
        <span className={item.reason ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}>{item.reason ? 'Не готово' : 'Готово к ручной проверке'}</span>
      </div>
      <p className="text-xs mt-1 opacity-70">{item.reason ? reasonLabels[item.reason] || item.reason : item.audioName}</p>
      <p className="text-xs mt-1 opacity-60">{item.occurredAt ? new Date(item.occurredAt).toLocaleString('ru-RU') : 'Время неизвестно'}</p>
    </div>)}</div>
  </section>;
}
