import { useRef, useState } from 'react';
import { api } from '../../../../api/client.js';
import { CURRICULUM_TEMPLATE } from '../../constants.js';
import { downloadJSON } from '../../utils.js';

export default function CurriculumImportForm({ token, onResult }) {
    const [json, setJson] = useState('');
    const [mode, setMode] = useState('merge');
    const [preserveProgress, setPreserveProgress] = useState(false);
    const [validation, setValidation] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const fileRef = useRef(null);

    const parse = () => {
        try {
            const data = JSON.parse(json);
            if (!Array.isArray(data)) throw new Error('Ожидается массив курсов');
            return { data, error: null };
        } catch (e) {
            return { data: null, error: e.message };
        }
    };

    const validate = async () => {
        setError(''); setValidation(null);
        const { data, error: parseError } = parse();
        if (parseError) { setError('Невалидный JSON: ' + parseError); return; }
        try {
            const v = await api('/admin/bulk/validate-curriculum', { method: 'POST', token, body: { data } });
            setValidation(v);
        } catch (e) { setError(e.message); }
    };

    const submit = async () => {
        setError('');
        const { data, error: parseError } = parse();
        if (parseError) { setError('Невалидный JSON: ' + parseError); return; }
        let v;
        try {
            v = await api('/admin/bulk/validate-curriculum', { method: 'POST', token, body: { data } });
        } catch (e) { setError(e.message); return; }
        setValidation(v);
        if (!v.valid) { setError(`Найдено ${v.totalErrors} ошибок.`); return; }

        const modeLabel = mode === 'replace'
            ? `⚠️ REPLACE: все уроки и тесты курсов из JSON будут удалены.${preserveProgress ? ' Прогресс сохранится по совпадающим.' : ' Прогресс студентов будет потерян.'}`
            : 'MERGE: существующие обновятся, новые добавятся.';
        if (!confirm(
            `${modeLabel}\n\nКурсов: ${v.stats.courses}, уроков: ${v.stats.lessons}, тестов: ${v.stats.tests}, вопросов: ${v.stats.questions}.\n\nПродолжить?`
        )) return;

        setBusy(true);
        try {
            const r = await api('/admin/bulk/import-curriculum', { method: 'POST', token, body: { data, mode, preserveProgress } });
            onResult?.(r);
            setJson(''); setValidation(null);
        } catch (e) {
            setError(e.message);
            if (e.errors) setValidation({ valid: false, errors: e.errors, stats: e.stats });
        } finally { setBusy(false); }
    };

    const handleFile = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => { setJson(String(ev.target.result || '')); setValidation(null); setError(''); };
        reader.onerror = () => setError('Не удалось прочитать файл');
        reader.readAsText(file);
    };

    return (
        <div className="space-y-3">
            <div className="text-xs text-white/50">Формат: массив курсов с уроками и тестами. Существующие курсы — по <code>slug</code>, уроки — по названию.</div>
            <div className="flex gap-2 flex-wrap">
                <button onClick={() => { setJson(JSON.stringify(CURRICULUM_TEMPLATE, null, 2)); setValidation(null); setError(''); }} className="chip bg-white/5 hover:bg-white/10">📋 Шаблон</button>
                <button onClick={() => downloadJSON(CURRICULUM_TEMPLATE, 'curriculum-template.json')} className="chip bg-white/5 hover:bg-white/10">⬇ Скачать шаблон</button>
                <button onClick={() => fileRef.current?.click()} className="chip bg-white/5 hover:bg-white/10">📂 Загрузить файл</button>
                <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={handleFile} />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
                <div>
                    <label className="text-xs text-white/40 uppercase block mb-1">Режим</label>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setMode('merge')} className={`chip ${mode === 'merge' ? 'bg-violet text-white' : 'bg-white/5 text-white/60'}`}>🔀 Merge</button>
                        <button onClick={() => setMode('replace')} className={`chip ${mode === 'replace' ? 'bg-pink text-white' : 'bg-white/5 text-white/60'}`}>♻️ Replace</button>
                    </div>
                </div>
                {mode === 'replace' && (
                    <label className="flex items-center gap-2 text-sm self-center">
                        <input type="checkbox" checked={preserveProgress} onChange={(e) => setPreserveProgress(e.target.checked)} />
                        Сохранять прогресс по совпадающим урокам
                    </label>
                )}
            </div>

            <textarea
                rows={10}
                className="input resize-none font-mono text-xs"
                placeholder='[{"slug":"kurs","title":"...","lessons":[{"title":"...","test":{"questions":[...]}}]}]'
                value={json}
                onChange={(e) => { setJson(e.target.value); setValidation(null); setError(''); }}
            />

            {validation && (
                <div className={`rounded-xl p-3 text-sm ${validation.valid ? 'bg-lime/10 border border-lime/30 text-lime' : 'bg-pink/10 border border-pink/30 text-pink'}`}>
                    {validation.valid ? (
                        <div>
                            <div className="font-bold mb-1">✓ Структура корректна</div>
                            <div className="text-white/70 text-xs">
                                Курсов: {validation.stats.courses} · уроков: {validation.stats.lessons} · тестов: {validation.stats.tests} · вопросов: {validation.stats.questions}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="font-bold mb-1">✕ Ошибок: {validation.totalErrors || validation.errors.length}</div>
                            <ul className="text-xs text-white/70 space-y-0.5 max-h-40 overflow-y-auto">
                                {validation.errors.map((err, i) => <li key={i}>• {err}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {error && <div className="text-sm text-pink bg-pink/10 rounded-xl p-3">{error}</div>}

            <div className="flex gap-2 flex-wrap">
                <button onClick={validate} disabled={!json.trim()} className="btn-ghost">🔍 Проверить</button>
                <button onClick={submit} disabled={busy || !json.trim()} className={mode === 'replace' ? 'btn-primary !bg-pink' : 'btn-primary'}>
                    {busy ? 'Импорт…' : mode === 'replace' ? '♻️ Импортировать (замена)' : '⬆ Импортировать'}
                </button>
            </div>
        </div>
    );
}