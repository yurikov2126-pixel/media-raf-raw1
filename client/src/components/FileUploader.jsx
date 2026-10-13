import { useState } from 'react';
import { uploadFileWithProgress } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

export default function FileUploader({
                                         files,
                                         onChange,
                                         maxFiles = 3,
                                         maxSizeMb = 50,
                                         accept,
                                         onBusyChange,
                                     }) {
    const { token } = useAuth();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(null);

    const handlePick = async (e) => {
        const picked = Array.from(e.target.files || []);
        if (!picked.length) return;

        const slotsLeft = maxFiles - files.length;
        const toUpload = picked.slice(0, slotsLeft);
        if (!toUpload.length) return;

        setBusy(true);
        onBusyChange?.(true);
        setError('');
        const uploaded = [];
        try {
            for (const [index, f] of toUpload.entries()) {
                if (f.size > maxSizeMb * 1024 * 1024) {
                    throw new Error(`Файл «${f.name}» больше ${maxSizeMb} МБ`);
                }
                setProgress({ name: f.name, index, count: toUpload.length, percent: 0 });
                const res = await uploadFileWithProgress(f, token, (percent) => setProgress({ name: f.name, index, count: toUpload.length, percent }));
                uploaded.push({
                    url: res.url,
                    name: f.name,
                    size: res.size ?? f.size,
                    type: res.type ?? f.type,
                });
            }
        } catch (err) {
            setError(err.message || 'Ошибка загрузки');
        } finally {
            if (uploaded.length) onChange([...files, ...uploaded]);
            setBusy(false);
            onBusyChange?.(false);
            setProgress(null);
            e.target.value = '';
        }
    };

    const remove = (idx) => { if (!busy) onChange(files.filter((_, i) => i !== idx)); };

    return (
        <div>
            <div className="flex flex-wrap gap-2 mb-2">
                {files.map((f, i) => (
                    <div
                        key={i}
                        className="flex items-center gap-2 text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1"
                    >
                        <span className="truncate max-w-[180px]" title={f.name}>
                            📎 {f.name}
                        </span>
                        <button
                            type="button"
                            onClick={() => remove(i)}
                            disabled={busy}
                            className="text-white/40 hover:text-red-400"
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>

            {files.length < maxFiles && (
                <label className="inline-block cursor-pointer text-sm text-violet-soft hover:underline">
                    {busy ? 'Загрузка…' : `+ Добавить файл (${files.length}/${maxFiles})`}
                    <input
                        type="file"
                        multiple
                        accept={accept}
                        onChange={handlePick}
                        disabled={busy}
                        className="hidden"
                    />
                </label>
            )}

            {progress && (
                <div className="mt-3 rounded-xl border border-violet-soft/30 bg-violet-soft/10 p-3" role="status" aria-live="polite">
                    <div className="flex justify-between gap-3 text-sm mb-2">
                        <span className="min-w-0 truncate text-white/85">📎 {progress.name}</span>
                        <span className="shrink-0 font-semibold text-violet-soft">{progress.percent}%</span>
                    </div>
                    <div role="progressbar" aria-label="Прогресс загрузки" aria-valuemin={0} aria-valuemax={100}
                        aria-valuenow={progress.percent} className="h-2.5 rounded-full overflow-hidden bg-white/10">
                        <div className="h-full bg-violet-soft transition-[width] duration-150" style={{ width: progress.percent + '%' }} />
                    </div>
                    <div className="flex justify-between text-xs text-white/60 mt-2 gap-3">
                        <span>Файл {progress.index + 1} из {progress.count}</span>
                        <span>Всего {Math.round((progress.index + progress.percent / 100) / progress.count * 100)}%</span>
                    </div>
                </div>
            )}
            {error && <div role="alert" className="text-xs text-red-300 mt-2">{error}</div>}
        </div>
    );
}