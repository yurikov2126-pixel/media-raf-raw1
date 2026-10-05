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
 * Inline-разметка: **жирный**, *курсив*, `код`, [ссылка](url).
 * Возвращает безопасную HTML-строку для dangerouslySetInnerHTML.
 */
function renderInline(text) {
    let s = escapeHtml(text);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    s = s.replace(
        /\[([^\]]+)\]\(([^)\s]+)\)/g,
        '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>'
    );
    return s;
}

/* ─────────── Таблицы ─────────── */

/**
 * Разделительная строка таблицы.
 * Пример: |---|---| или |:---|:---:|---:|
 */
function isTableSeparator(line) {
    const t = line.trim();
    if (!t.includes('-')) return false;
    // Только -, :, | и пробелы
    return /^\|?[\s:|-]+\|?$/.test(t);
}

/**
 * Есть ли тут начало таблицы:
 * текущая строка содержит "|" и следующая — разделитель.
 */
function isTableStart(lines, i) {
    const cur = lines[i];
    const next = lines[i + 1];
    if (cur == null || next == null) return false;
    if (!cur.includes('|')) return false;
    return isTableSeparator(next);
}

/** Разбивает строку "| a | b | c |" на ["a", "b", "c"]. */
function splitTableRow(line) {
    let t = line.trim();
    if (t.startsWith('|')) t = t.slice(1);
    if (t.endsWith('|')) t = t.slice(0, -1);
    return t.split('|').map((c) => c.trim());
}

/** Определяет выравнивание колонки по разделителю: left | center | right | none */
function parseAlignments(sepLine) {
    const cells = splitTableRow(sepLine);
    return cells.map((c) => {
        const t = c.trim();
        const left = t.startsWith(':');
        const right = t.endsWith(':');
        if (left && right) return 'center';
        if (right) return 'right';
        if (left) return 'left';
        return null;
    });
}

function renderTable(headerCells, rows, alignments) {
    const styleFor = (i) => {
        const a = alignments[i];
        return a ? ` style="text-align:${a}"` : '';
    };
    const thead = headerCells
        .map((c, i) => `<th${styleFor(i)}>${renderInline(c)}</th>`)
        .join('');
    const tbody = rows
        .map(
            (r) =>
                '<tr>' +
                headerCells
                    .map((_, i) => {
                        const cell = r[i] ?? '';
                        return `<td${styleFor(i)}>${renderInline(cell)}</td>`;
                    })
                    .join('') +
                '</tr>'
        )
        .join('');
    return `<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
}

/* ─────────── Компонент ─────────── */

/**
 * Markdown → HTML.
 * Поддерживает:
 *   # / ## / ### / #### заголовки
 *   **жирный**, *курсив*, `inline`, [ссылки](url)
 *   - и 1. списки
 *   > цитаты
 *   ```code blocks```
 *   --- разделитель
 *   Таблицы (| a | b | + строка-разделитель)
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

        /* ─── Блок кода ``` ─── */
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

        /* ─── Пустая строка ─── */
        if (!line.trim()) {
            closeList();
            closeBlockquote();
            continue;
        }

        /* ─── Горизонтальный разделитель --- ─── */
        if (/^---+\s*$/.test(line)) {
            closeList();
            closeBlockquote();
            out.push('<hr />');
            continue;
        }

        /* ─── Таблица ───
           Ловим её ДО заголовков, потому что строка может начинаться
           с "|", а не с "#". */
        if (isTableStart(lines, i)) {
            closeList();
            closeBlockquote();

            const headerCells = splitTableRow(line);
            const alignments = parseAlignments(lines[i + 1]);

            // собираем строки тела
            const rows = [];
            let j = i + 2;
            while (j < lines.length && lines[j].includes('|') && lines[j].trim()) {
                rows.push(splitTableRow(lines[j]));
                j++;
            }

            out.push(renderTable(headerCells, rows, alignments));
            i = j - 1; // пропускаем обработанные строки
            continue;
        }

        /* ─── Заголовки #..###### ─── */
        const h = line.match(/^(#{1,6})\s+(.*)$/);
        if (h) {
            closeList();
            closeBlockquote();
            const lvl = h[1].length;
            out.push(`<h${lvl}>${renderInline(h[2])}</h${lvl}>`);
            continue;
        }

        /* ─── Цитата ─── */
        if (line.startsWith('> ')) {
            closeList();
            if (!inBlockquote) { out.push('<blockquote>'); inBlockquote = true; }
            out.push(`<p>${renderInline(line.slice(2))}</p>`);
            continue;
        } else {
            closeBlockquote();
        }

        /* ─── Маркированный список ─── */
        if (/^[-*]\s+/.test(line)) {
            if (inOrderedList) { out.push('</ol>'); inOrderedList = false; }
            if (!inList) { out.push('<ul>'); inList = true; }
            out.push(`<li>${renderInline(line.replace(/^[-*]\s+/, ''))}</li>`);
            continue;
        }

        /* ─── Нумерованный список ─── */
        if (/^\d+\.\s+/.test(line)) {
            if (inList) { out.push('</ul>'); inList = false; }
            if (!inOrderedList) { out.push('<ol>'); inOrderedList = true; }
            out.push(`<li>${renderInline(line.replace(/^\d+\.\s+/, ''))}</li>`);
            continue;
        }

        closeList();

        /* ─── Обычный абзац ─── */
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