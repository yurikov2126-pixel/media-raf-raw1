import { useEffect, useState } from 'react';
import { api } from '../../../api/client.js';

export default function MchsEventTypeRules({ token }) {
  const [data, setData] = useState(null);
  const [rules, setRules] = useState({});
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    api('/safety/event-type-rules', { token }).then(result => {
      if (!active) return;
      setData(result);
      setRules(result.rules);
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [token]);
  const change = (type, field, value) => setRules(old => ({
    ...old, [type]: { ...old[type], [field]: value },
  }));
  const save = async type => {
    setSaving(type); setError(''); setMessage('');
    try {
      const rule = rules[type];
      const response = await api('/safety/event-type-rules/' + type, {
        token, method: 'PUT',
        body: { mode: rule.mode, audioAssetId: rule.audioAssetId || null, note: rule.note || '' },
      });
      change(type, 'updatedAt', response.rule.updatedAt);
      setMessage('Шаблон сохранён для анализа. Автоматическое вещание не включено.');
    } catch (e) { setError(e.message); } finally { setSaving(''); }
  };
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5 md:p-5">
    <h3 className="text-lg font-semibold">Четыре типа оповещений</h3>
    <p className="text-sm opacity-70">Распознавание выполняется по тексту Android. Неоднозначные уведомления остаются без категории. Выберите аудио и необходимость проверки оператором отдельно для каждого типа. Эти правила не запускают эфир.</p>
    {error && <p role="alert" className="text-red-600 dark:text-red-300 text-sm">{error}</p>}
    {message && <p role="status" className="text-emerald-700 dark:text-emerald-300 text-sm">{message}</p>}
    {!data && !error && <p>Загрузка…</p>}
    {data?.types?.map(type => {
      const rule = rules[type.id] || { mode: 'IGNORE', audioAssetId: null, note: '' };
      const count = (data.classifications || []).filter(e => e.type === type.id).length;
      return <div key={type.id} className="rounded-xl border border-slate-200 p-4 dark:border-white/10 space-y-3">
        <div className="flex flex-wrap justify-between gap-2">
          <h4 className="font-semibold">{type.label}</h4>
          <span className="text-xs opacity-60">Распознано среди последних 100: {count}</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">Реакция
            <select value={rule.mode} onChange={e => change(type.id, 'mode', e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-transparent p-2 dark:border-white/20">
              <option value="IGNORE">Не предлагать оповещение</option>
              <option value="REVIEW">Предложить оператору для проверки</option>
            </select>
          </label>
          <label className="text-sm">Аудиозапись
            <select value={rule.audioAssetId || ''} onChange={e => change(type.id, 'audioAssetId', e.target.value || null)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-transparent p-2 dark:border-white/20">
              <option value="">Не выбрана</option>
              {(data.assets || []).map(asset => <option value={asset.id} key={asset.id}>{asset.name}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-sm">Комментарий
          <input maxLength={500} value={rule.note || ''} onChange={e => change(type.id, 'note', e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-transparent p-2 dark:border-white/20" placeholder="Требования к проверке сообщения"/>
        </label>
        <button type="button" disabled={saving === type.id} onClick={() => save(type.id)} className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white font-semibold disabled:opacity-50">{saving === type.id ? 'Сохранение…' : 'Сохранить шаблон'}</button>
      </div>;
    })}
  </section>;
}
