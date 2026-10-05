import { useState } from 'react';
import { uploadFile } from '../api/client.js';
import { useAuth } from '../store/auth.jsx';

export default function FileUploader({
                                         files,
                                         onChange,
                                         maxFiles = 3,
                                         maxSizeMb = 50,
                                         accept,
                                     }) {
    const { token } = useAuth();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const handlePick = async (e) => {
        const picked = Array.from(e.target.files || []);
        if (!picked.length) return;

        const slotsLeft = maxFiles - files.length;
        const toUpload = picked.slice(0, slotsLeft);

        setBusy(true);
        setError('');
        try {
            const uploaded = [];
            for (const f of toUpload) {
                if (f.size > maxSizeMb * 1024 * 1024) {
                    throw new Error(`Файл «${f.name}» больше ${maxSizeMb} МБ`);
                }
                const res = await uploadFile(f, token);
                uploaded.push({
                    url: res.url,
                    name: f.name,
                    size: res.size ?? f.size,
                    type: res.type ?? f.type,
                });
            }
            onChange([...files, ...uploaded]);
        } catch (err) {
            setError(err.message || 'Ошибка загрузки');
        } finally {
            setBusy(false);
            e.target.value = '';
        }
    };

    const remove = (idx) => onChange(files.filter((_, i) => i !== idx));

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

            {error && <div className="text-xs text-red-400 mt-1">{error}</div>}
        </div>
    );
}