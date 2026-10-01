export default function PinnedBar({ message, onUnpin, onJump }) {
    if (!message) return null;

    const preview =
        message.deletedAt ? 'сообщение удалено' :
            message.type === 'image' ? '🖼️ Изображение' :
                message.type === 'sticker' ? '🎨 Стикер' :
                    message.content;

    return (
        <div className="flex items-center gap-3 px-3 py-2 border-b border-white/5 bg-ink-800/70 shrink-0">
            <div className="text-violet-soft text-lg">📌</div>
            <button
                onClick={onJump}
                className="flex-1 min-w-0 text-left hover:opacity-90 transition"
            >
                <div className="text-[10px] uppercase tracking-wider text-violet-soft">
                    Закреплено
                </div>
                <div className="text-sm text-white/80 truncate">
                    {message.sender?.fullName && !message.deletedAt && (
                        <span className="text-white/50">{message.sender.fullName}: </span>
                    )}
                    {preview}
                </div>
            </button>
            <button
                onClick={onUnpin}
                className="text-white/40 hover:text-pink text-sm shrink-0 px-2"
                title="Открепить"
            >
                ✕
            </button>
        </div>
    );
}