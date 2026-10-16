export function presenceLabel(lastSeen, online = false) {
    if (online) return 'в сети';
    if (!lastSeen) return 'давно не был(а) в сети';
    const date = new Date(lastSeen);
    if (Number.isNaN(date.getTime())) return 'давно не был(а) в сети';
    const now = new Date();
    const delta = Math.max(0, now.getTime() - date.getTime());
    if (delta < 60_000) return 'был(а) только что';
    if (delta < 60 * 60_000) return `был(а) ${Math.floor(delta / 60_000)} мин. назад`;
    if (now.toDateString() === date.toDateString()) return `был(а) сегодня в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (yesterday.toDateString() === date.toDateString()) return `был(а) вчера в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    return `был(а) ${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })} в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}
