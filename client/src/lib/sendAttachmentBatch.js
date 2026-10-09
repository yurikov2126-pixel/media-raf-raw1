/**
 * Sends a batch of attachments with stable per-file idempotency keys.
 * Successful uploads survive lost Socket.IO acknowledgements during retries.
 */
export async function sendAttachmentBatch({
    files, captions, replyToId, chatId, token, socket, upload,
    onProgress = () => {}, onFileSent = () => {}, retryCache = new Map(),
    makeId = () => crypto.randomUUID(),
}) {
    let completed = 0;
    try {
        for (const file of files) {
            const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
            const previous = retryCache.get(file);
            const requestId = previous?.requestId || makeId();
            const result = previous?.result || await upload(file, token, (percent) => {
                onProgress(Math.round(((completed + percent / 100) / files.length) * 100));
            });
            retryCache.set(file, { requestId, result });
            await new Promise((resolve, reject) => {
                socket.timeout(15000).emit('message:send', {
                    chatId, content: result.url, type, clientMessageId: requestId,
                    caption: (captions[completed] || '').trim() || undefined,
                    replyToId: completed === 0 ? replyToId : undefined,
                }, (error, response) => {
                    if (error || response?.error) reject(new Error(response?.error || 'Сервер не подтвердил сообщение'));
                    else resolve();
                });
            });
            retryCache.delete(file);
            completed++;
            onFileSent(completed);
            onProgress(Math.round(completed / files.length * 100));
        }
        return { completed, remaining: [], captions: {} };
    } catch (error) {
        return {
            completed, remaining: files.slice(completed),
            captions: Object.fromEntries(Object.entries(captions)
                .filter(([index]) => Number(index) >= completed)
                .map(([index, value]) => [Number(index) - completed, value])),
            error,
        };
    }
}
