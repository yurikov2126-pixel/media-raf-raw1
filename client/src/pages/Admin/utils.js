export function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function fmtSize(n) {
    if (n == null) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function fmtUptime(sec) {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d > 0) return `${d}д ${h}ч ${m}м`;
    if (h > 0) return `${h}ч ${m}м`;
    return `${m}м`;
}

export function renderMarkdownSimple(text) {
    if (!text) return '';
    const esc = (s) =>
        String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    const inline = (line) =>
        esc(line)
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');

    const lines = String(text).replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let inList = false;
    let inOrdered = false;
    const close = () => {
        if (inList) { out.push('</ul>'); inList = false; }
        if (inOrdered) { out.push('</ol>'); inOrdered = false; }
    };
    for (const line of lines) {
        if (!line.trim()) { close(); continue; }
        const h = line.match(/^(#{1,6})\s+(.*)$/);
        if (h) { close(); const l = h[1].length; out.push(`<h${l}>${inline(h[2])}</h${l}>`); continue; }
        if (line.startsWith('> ')) { close(); out.push(`<blockquote><p>${inline(line.slice(2))}</p></blockquote>`); continue; }
        if (/^[-*]\s+/.test(line)) {
            if (inOrdered) { out.push('</ol>'); inOrdered = false; }
            if (!inList) { out.push('<ul>'); inList = true; }
            out.push(`<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`);
            continue;
        }
        if (/^\d+\.\s+/.test(line)) {
            if (inList) { out.push('</ul>'); inList = false; }
            if (!inOrdered) { out.push('<ol>'); inOrdered = true; }
            out.push(`<li>${inline(line.replace(/^\d+\.\s+/, ''))}</li>`);
            continue;
        }
        close();
        out.push(`<p>${inline(line)}</p>`);
    }
    close();
    return out.join('\n');
}