export function mentionLocation(p = {}) {
    if (p.commentId) return 'в комментарии';
    if (p.postId) return 'в публикации';
    if (p.chatId) return 'в чате';
    return '';
}

export function mentionTitle(p = {}) {
    const location = mentionLocation(p);
    return (p.senderName || 'Кто-то') + ' упомянул вас' + (location ? ' ' + location : '');
}

export function mentionPreview(p = {}) {
    const context = p.chatId && p.chatTitle ? p.chatTitle + ': ' : '';
    return context + (p.preview || p.message || '');
}
