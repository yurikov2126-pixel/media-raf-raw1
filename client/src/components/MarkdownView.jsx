import React from 'react';

/* Собирает регулярку для одного inline-паттерна.
   Поддерживает: **жирный**, *курсив*, `код`, [ссылку](url). */
const INLINE_RE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]]+\]\([^)\s]+\))/g;

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderInline(text) {
    const parts = [];
    let lastIndex = 0;
    let match;
    INLINE_RE.lastIndex = 0;
    while ((match = INLINE_RE.exec(text)) !== null) {
        if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
        const m = match[0];

        if (m.startsWith('**')) {
            parts.push(<strong key={`b-${match.index}`}>{m.slice(2, -2)}</strong>);
        } else if (m.startsWith('`')) {
            parts.push(
                <code
                    key={`c-${match.index}`}
                    className="px-1.5 py-0.5 rounded-md bg-black/40 text-cyan-soft text-[0.85em] font-mono"
                >
                    {m.slice(1, -1)}
                </code>
            );
        } else if (m.startsWith('[')) {
            const textMatch = m.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
            if (textMatch) {
                const url = textMatch[2];
                const isExternal = /^https?:\/\//i.test(url);
                parts.push(
                    <a
                        key={`a-${match.index}`}
                        href={url}
                        className="text-violet-soft hover:underline"
                        {...(isExternal ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                    >
                        {textMatch[1]}
                    </a>
                );
            } else {
                parts.push(m);
            }
        } else {
            parts.push(<em key={`i-${match.index}`}>{m.slice(1, -1)}</em>);
        }
        lastIndex = match.index + m.length;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
}

/**
 * Рендер Markdown-текста.
 * Поддерживает: # / ## / ### / #### заголовки, **жирный**, *курсив*,
 * `inline-код`, ```code blocks```, - / 1. списки, > цитаты, [ссылки](url),
 * --- горизонтальный разделитель.
 *
 * Итоговая разметка оформляется классами .mrr-md-content (см. index.css).
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

        // Заголовки
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