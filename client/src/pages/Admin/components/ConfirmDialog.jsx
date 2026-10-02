export default function ConfirmDialog({
                                          open,
                                          title,
                                          description,
                                          confirmLabel = 'Подтвердить',
                                          cancelLabel = 'Отмена',
                                          danger,
                                          busy,
                                          onConfirm,
                                          onCancel,
                                      }) {
    if (!open) return null;
    return (
        <div
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm grid place-items-center p-4"
            onClick={() => !busy && onCancel?.()}
        >
            <div className="card max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}>
                <div className="text-2xl mb-2">{danger ? '⚠️' : '❓'}</div>
                <h3 className="text-xl font-bold mb-3">{title}</h3>
                {description && <div className="text-sm text-white/70 mb-4 whitespace-pre-wrap">{description}</div>}
                <div className="flex justify-end gap-2">
                    <button onClick={onCancel} disabled={busy} className="btn-ghost">
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={busy}
                        className={danger ? 'btn-primary !bg-pink' : 'btn-primary'}
                    >
                        {busy ? '…' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}