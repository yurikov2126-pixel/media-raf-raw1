import { useEffect, useRef, useState } from 'react';
const API = import.meta.env.VITE_API || 'http://localhost:4000/api';
import { api } from '../../../api/client.js';

export default function MchsEventTypeRules({ token }) {
  const [data, setData] = useState(null);
  const [rules, setRules] = useState({});
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [dispatchMode, setDispatchMode] = useState('MANUAL');
  const [modeSaving, setModeSaving] = useState(false);
  const playerRef = useRef(null);
  const audioUrlRef = useRef(null);
  const [playing, setPlaying] = useState('');
  useEffect(() => () => {
    playerRef.current?.pause();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);
  const stopPreview = () => {
    playerRef.current?.pause();
    playerRef.current?.removeAttribute('src');
    playerRef.current?.load();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    setPlaying('');
  };
  const preview = async (type, assetId) => {
    if (playing === type) { stopPreview(); return; }
    const asset = data?.assets?.find(item => item.id === assetId);
    if (!asset) { setError('Выберите доступную запись ALARM'); return; }
    stopPreview(); setError('');
    try {
      const response = await fetch(API + '/radio/assets/' + encodeURIComponent(asset.id) + '/audio',
        { headers: { Authorization: 'Bearer ' + token } });
      if (!response.ok) throw new Error('Не удалось загрузить аудиозапись');
      const url = URL.createObjectURL(await response.blob());
      audioUrlRef.current = url;
      playerRef.current.src = url;
      playerRef.current.volume = 0.35;
      await playerRef.current.play();
      setPlaying(type);
    } catch (e) { stopPreview(); setError(e.message); }
  };
  useEffect(() => {
    let active = true;
    api('/safety/event-type-rules', { token }).then(result => {
      if (!active) return;
      setData(result);
      setRules(result.rules);
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [token]);
  useEffect(() => {
    let mounted = true;
    api('/safety/dispatch-mode', { token }).then(result => {
      if (mounted) setDispatchMode(result.mode);
    }).catch(e => { if (mounted) setError(e.message); });
    return () => { mounted = false; };
  }, [token]);
  const saveMode = async mode => {
    setModeSaving(true); setMessage(''); setError('');
    try {
      const result = await api('/safety/dispatch-mode', { token, method: 'PUT', body: { mode } });
      setDispatchMode(result.mode);
      setMessage('Режим сохранён для подготовки. Звук в громкоговорители не передаётся.');
    } catch (e) { setError(e.message); } finally { setModeSaving(false); }
  };
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
    <audio ref={playerRef} onEnded={stopPreview} aria-label="Локальный предпросмотр оповещения" />
    <h3 className="text-lg font-semibold">Четыре типа оповещений</h3>
    <p className="text-xs opacity-70">Прослушивание запускается только по нажатию и звучит исключительно на текущем устройстве администратора. Radio Worker, публичный поток и громкоговорители не затрагиваются.</p>
    <div className="rounded-xl border border-amber-300/50 bg-amber-100/40 p-3 space-y-2 dark:bg-amber-400/10">
      <h4 className="font-semibold">Режим обработки — подготовка</h4>
      <p className="text-sm opacity-80">Автоматический режим пока доступен только для изолированной симуляции. Ни один режим не отправляет аудио на громкоговорители или в прямой эфир.</p>
      <label className="block text-sm">Выберите режим
        <select aria-label="Режим обработки уведомлений МЧС" disabled={modeSaving} className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent p-2 dark:border-white/20" value={dispatchMode} onChange={e => saveMode(e.target.value)}>
          <option value="MANUAL">Ручной — проверка и подтверждение (подготовка)</option>
          <option value="AUTO_SIMULATION">Автоматический — только симуляция, без громкоговорителей</option>
        </select>
      </label>
    </div>
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
        <button type="button" disabled={!rule.audioAssetId} onClick={() => preview(type.id, rule.audioAssetId)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-white/20 disabled:opacity-50">{playing === type.id ? 'Остановить прослушивание' : 'Прослушать выбранное ALARM'}</button>
        <label className="block text-sm">Комментарий
          <input maxLength={500} value={rule.note || ''} onChange={e => change(type.id, 'note', e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-transparent p-2 dark:border-white/20" placeholder="Требования к проверке сообщения"/>
        </label>
        <button type="button" disabled={saving === type.id} onClick={() => save(type.id)} className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white font-semibold disabled:opacity-50">{saving === type.id ? 'Сохранение…' : 'Сохранить шаблон'}</button>
      </div>;
    })}
  </section>;
}
