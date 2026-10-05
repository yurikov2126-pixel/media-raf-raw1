import React from 'react';

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Инлайновая разметка: **жирный**, *курсив*, `код`, [ссылка](url).
 * Возвращает HTML-строку, безопасную для dangerouslySetInnerHTML,
 * потому что сначала экранируется исходный текст, а потом
 * в него вставляются только наши теги.
 */
function renderInline(text) {
    let s = escapeHtml(text);

    // 1) bold: **...** (жадно до следующего **)
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // 2) italic: *...* (не задевая остатки от bold)
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

    // 3) inline code: `...`
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // 4) ссылки: [текст](url)
    s = s.replace(
        /\[([^\]]+)\]\(([^)\s]+)\)/g,
        '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>'
    );

    return s;
}

/**
 * Markdown → HTML.
 * Поддерживает:
 *   # / ## / ### / #### заголовки
 *   **жирный**, *курсив*, `inline`, [ссылки](url)
 *   - и 1. списки
 *   > цитаты
 *   ```code blocks```
 *   --- разделитель
 *
 * Стили задаются классом .mrr-md-content (см. index.css).
 */
export default function MarkdownView({ text, className = '' }) {
    if (!text) return null;

    const lines = String(text).replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let inCode = false;
    let codeBuf = [];
    let inList = false;
    let inOrderedList = false;
    let inBlockquote = false;

    const closeList = () => {
        if (inList) { out.push('</ul>'); inList = false; }
        if (inOrderedList) { out.push('</ol>'); inOrderedList = false; }
    };
    const closeBlockquote = () => {
        if (inBlockquote) { out.push('</blockquote>'); inBlockquote = false; }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Блок кода ```
        if (line.trim().startsWith('```')) {
            if (inCode) {
                out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
                codeBuf = [];
                inCode = false;
            } else {
                closeList();
                closeBlockquote();
                inCode = true;
            }
            continue;
        }
        if (inCode) {
            codeBuf.push(line);
            continue;
        }

        // Пустая строка
        if (!line.trim()) {
            closeList();
            closeBlockquote();
            continue;
        }

        // Горизонтальный разделитель ---
        if (/^---+\s*$/.test(line)) {
            closeList();
            closeBlockquote();
            out.push('<hr />');
            continue;
        }

        // Заголовки #..######
        const h = line.match(/^(#{1,6})\s+(.*)$/);
        if (h) {
            closeList();
            closeBlockquote();
            const lvl = h[1].length;
            out.push(`<h${lvl}>${renderInline(h[2])}</h${lvl}>`);
            continue;
        }

        // Цитата
        if (line.startsWith('> ')) {
            closeList();
            if (!inBlockquote) { out.push('<blockquote>'); inBlockquote = true; }
            out.push(`<p>${renderInline(line.slice(2))}</p>`);
            continue;
        } else {
            closeBlockquote();
        }

        // Маркированный список
        if (/^[-*]\s+/.test(line)) {
            if (inOrderedList) { out.push('</ol>'); inOrderedList = false; }
            if (!inList) { out.push('<ul>'); inList = true; }
            out.push(`<li>${renderInline(line.replace(/^[-*]\s+/, ''))}</li>`);
            continue;
        }

        // Нумерованный список
        if (/^\d+\.\s+/.test(line)) {
            if (inList) { out.push('</ul>'); inList = false; }
            if (!inOrderedList) { out.push('<ol>'); inOrderedList = true; }
            out.push(`<li>${renderInline(line.replace(/^\d+\.\s+/, ''))}</li>`);
            continue;
        }

        closeList();

        // Обычный абзац
        out.push(`<p>${renderInline(line)}</p>`);
    }

    if (inCode) {
        out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
    }
    closeList();
    closeBlockquote();

    return (
        <div
            className={`mrr-md-content ${className}`}
            dangerouslySetInnerHTML={{ __html: out.join('\n') }}
        />
    );
}