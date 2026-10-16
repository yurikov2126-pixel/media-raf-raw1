import { useRef, useState } from 'react';
import AttachmentPreview from './AttachmentPreview.jsx';

/** Presentation-only editor: existing batch sender keeps upload/retry semantics. */
export default function AttachmentEditorV2({
    files, captions, onFilesChange, onCaptionsChange, onCancel,
    onSend, uploading, progress, sentCount,
}) {
    const [dragging, setDragging] = useState(-1);
    const gesture = useRef(null);
    const finishDrag = (to) => {
        const from = gesture.current?.from;
        gesture.current = null;
        setDragging(-1);
        if (typeof from === 'number' && to !== null && from !== to) move(from, to);
    };
    const startPointer = (event, index) => {
        if (uploading || (event.pointerType === 'mouse' && event.button !== 0)) return;
        gesture.current = { from: index, pointerId: event.pointerId };
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(index);
    };
    const updatePointer = (event) => {
        if (!gesture.current || event.pointerId !== gesture.current.pointerId) return;
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-attachment-index]');
        if (target) gesture.current.to = Number(target.dataset.attachmentIndex);
    };
    const endPointer = (event) => {
        if (!gesture.current || event.pointerId !== gesture.current.pointerId) return;
        updatePointer(event);
        finishDrag(gesture.current.to ?? gesture.current.from);
    };
    const move = (from, to) => {
        if (uploading || to < 0 || to >= files.length) return;
        const indices = files.map((_, i) => i);
        const [picked] = indices.splice(from, 1);
        indices.splice(to, 0, picked);
        onFilesChange(indices.map((i) => files[i]));
        onCaptionsChange(Object.fromEntries(indices.map((i, newIndex) => [newIndex, captions[i] || ''])));
    };
    const remove = (index) => {
        if (uploading) return;
        const remaining = files.map((_, i) => i).filter((i) => i !== index);
        onFilesChange(remaining.map((i) => files[i]));
        onCaptionsChange(Object.fromEntries(remaining.map((i, newIndex) => [newIndex, captions[i] || ''])));
    };
    return (
        <div className="mrr-v2-attachment-editor" role="region" aria-label="Подготовка вложений">
            <div className="mrr-v2-attachment-heading">
                <div><div className="font-bold text-base">Материалы к отправке</div>
                    <div className="text-xs opacity-60 mt-1">{files.length} из 20 · Подпись для каждого файла</div></div>
                <button type="button" className="mrr-v2-attachment-close" onClick={onCancel} disabled={uploading} aria-label="Отменить вложения">✕</button>
            </div>
            <div className="mrr-v2-attachment-grid">
                {files.map((file, index) => (
                    <div key={index + ':' + file.name + ':' + file.size} className={`mrr-v2-attachment-card ${dragging === index ? "mrr-v2-attachment-dragging" : ""}`} data-attachment-index={index}>
                        <div className="mrr-v2-attachment-thumb"><AttachmentPreview file={file}/></div>
                        <div className="min-w-0 flex-1 mrr-v2-attachment-details">
                            <div className="font-semibold text-xs truncate" title={file.name}>{file.name}</div>
                            <div className="text-xs opacity-60">{(file.size / 1048576).toFixed(1)} МБ</div>
                            <textarea rows={1} value={captions[index] || ''} disabled={uploading} maxLength={2000}
                                onChange={(e) => onCaptionsChange((current) => ({ ...current, [index]: e.target.value }))}
                                className="mrr-v2-attachment-caption" placeholder="Подпись к файлу…" aria-label={`Подпись для ${file.name}`}/>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="mrr-v2-attachment-handle" role="button" tabIndex={uploading ? -1 : 0} aria-disabled={uploading}
                                    aria-label={`Перетащить ${file.name}, позиция ${index + 1} из ${files.length}`}
                                    onPointerDown={(event) => startPointer(event, index)}
                                    onPointerMove={updatePointer}
                                    onPointerUp={endPointer}
                                    onPointerCancel={() => finishDrag(null)}
                                    onKeyDown={(event) => {
                                        if (uploading) return;
                                        if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') { event.preventDefault(); move(index, index - 1); }
                                        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { event.preventDefault(); move(index, index + 1); }
                                    }}>⠿ <span className="sr-only">Переместить</span></span>
                                <span className="text-xs opacity-60">{index + 1} / {files.length}</span>
                                <button type="button" disabled={uploading} onClick={() => remove(index)} className="mrr-v2-attachment-action ml-auto" aria-label={`Удалить ${file.name}`}>Удалить</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {uploading && <div role="status" aria-live="polite" className="space-y-1">
                <div className="flex justify-between text-xs"><span>Отправлено {sentCount} из {files.length}</span><span>{progress}%</span></div>
                <progress className="w-full accent-violet" value={progress} max="100" aria-label="Прогресс загрузки материалов"/>
            </div>}
            <button type="button" onClick={onSend} disabled={uploading || !files.length} className="btn-primary w-full !py-3">
                {uploading ? 'Отправка материалов…' : `Отправить ${files.length} файл(ов)`}
            </button>
        </div>
    );
}
