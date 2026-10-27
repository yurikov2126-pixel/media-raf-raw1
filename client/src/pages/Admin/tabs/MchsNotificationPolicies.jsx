import { useEffect, useState } from 'react';
import { api } from '../../../api/client.js';

export default function MchsNotificationPolicies({ token, events = [] }) {
  const [data, setData] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  useEffect(() => {
    let active = true;
    api('/safety/notification-policy-drafts', { token })
      .then(result => {
        if (!active) return;
        setData(result);
        setDrafts(result.rules || {});
      })
      .catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [token]);
  const setField = (id, field, value) => setDrafts(current => ({
    ...current, [id]: { mode: 'IGNORE', audioAssetId: null, note: '', ...current[id], [field]: value },
  }));
  const save = async id => {
    setSaving(id); setSaved(''); setError('');
    const draft = drafts[id] || {};
    try {
      const result = await api('/safety/notification-policy-drafts/' + encodeURIComponent(id), {
        token, method: 'PUT',
        body: { mode: draft.mode || 'IGNORE', audioAssetId: draft.audioAssetId || null, note: draft.note || '' },
      });
      setField(id, 'updatedAt', result.rule.updatedAt);
      setSaved('Настройка сохранена. Автоматический запуск эфира заблокирован.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving('');
    }
  };
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5 md:p-5">
    <div>
      <h3 className="text-lg font-semibold">Правила реагирования на уведомления</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-white/65">Для каждого наблюдения выберите, нужно ли предлагать оповещение оператору и какой аудиофайл использовать. Это предварительные правила: они не запускают Политех-FM или громкоговорители.</p>
    </div>
    {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
    {saved && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{saved}</p>}
    {!data && !error && <p className="text-sm opacity-70">Загрузка вариантов звука…</p>}
    {data && !events.length && <p className="text-sm opacity-70">Пока нет уведомлений для настройки.</p>}
    {data && events.map(event => {
      const draft = drafts[event.id] || { mode: 'IGNORE', audioAssetId: null, note: '' };
      return <div key={event.id} className="rounded-xl border border-slate-200 p-3 dark:border-white/10 space-y-3">
        <div className="min-w-0">
          <div className="text-xs opacity-60">{event.occurredAt ? new Date(event.occurredAt).toLocaleString('ru-RU') : 'Время неизвестно'} · {event.region || 'Регион не указан'}</div>
          <h4 className="font-semibold mt-1 break-words">{event.title}</h4>
          <p className="mt-1 text-xs opacity-65 line-clamp-2 break-words">{event.body}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">Решение оператора
            <select className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent p-2 dark:border-white/20" value={draft.mode || 'IGNORE'} onChange={e => setField(event.id, 'mode', e.target.value)}>
              <option value="IGNORE">Не предлагать оповещение</option>
              <option value="REVIEW">Предложить оповещение для ручной проверки</option>
            </select>
          </label>
          <label className="text-sm">Аудиофайл для предполагаемого оповещения
            <select className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent p-2 dark:border-white/20" value={draft.audioAssetId || ''} onChange={e => setField(event.id, 'audioAssetId', e.target.value || null)}>
              <option value="">Не выбран</option>
              {(data.assets || []).map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-sm">Комментарий к правилу
          <textarea rows={2} maxLength={500} value={draft.note || ''} onChange={e => setField(event.id, 'note', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent p-2 dark:border-white/20" placeholder="Например: требуется подтверждение актуальности и территории" />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={saving === event.id} onClick={() => save(event.id)} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving === event.id ? 'Сохранение…' : 'Сохранить правило'}</button>
          <span className="text-xs text-slate-500 dark:text-white/55">Только настройка, без воспроизведения</span>
        </div>
      </div>;
    })}
  </section>;
}
