import React from 'react';

// Собирает регулярку для одного inline-паттерна
const INLINE_RE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?:\/[\w\-./?%&=+#~:]*)?|\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|@[a-z0-9_]{3,20})/gi;

function renderInline(text, highlights = new Set()) {
    const parts = [];
    let lastIndex = 0;
    let match;
    INLINE_RE.lastIndex = 0;
    while ((match = INLINE_RE.exec(text)) !== null) {
        if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
        const m = match[0];

        if (/^(https?:\/\/|www\.)/i.test(m) || /^[a-z0-9-]+(?:\.[a-z0-9-]+)+/i.test(m)) {
            // Do not turn sentence punctuation into a URL; never accept unsafe schemes.
            const clean = m.replace(/[.,!?;:]+$/g, '').replace(/\)+$/g, '');
            const suffix = m.slice(clean.length);
            let target;
            try {
                const url = new URL(/^https?:\/\//i.test(clean) ? clean : `https://${clean}`);
                if (['https:', 'http:'].includes(url.protocol) && url.hostname.includes('.')) target = url.href;
            } catch { /* leave malformed addresses as plain text */ }
            if (target) parts.push(
                <a key={`url-${match.index}`} href={target} target="_blank" rel="noopener noreferrer"
                    className="mrr-message-link underline underline-offset-2 break-all"
                    onClick={(event) => event.stopPropagation()}
                    onTouchStart={(event) => event.stopPropagation()}
                    onTouchMove={(event) => event.stopPropagation()}
                    onTouchEnd={(event) => event.stopPropagation()}
                    onContextMenu={(event) => event.stopPropagation()}>
                    {clean}
                </a>
            );
            else parts.push(clean);
            if (suffix) parts.push(suffix);
        } else if (m.startsWith('**')) {
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
        } else if (m.startsWith('@')) {
            const isMe = highlights.has(m.slice(1).toLowerCase());
            parts.push(
                <span
                    key={`m-${match.index}`}
                    className={isMe
                        ? 'px-1 rounded bg-violet/40 text-white font-semibold'
                        : 'px-1 rounded bg-white/10 text-violet-soft font-semibold'}
                >
          {m}
        </span>
            );
        } else {
            parts.push(<em key={`i-${match.index}`}>{m.slice(1, -1)}</em>);
        }
        lastIndex = match.index + m.length;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
}

/**
 * props:
 *   text — текст сообщения
 *   highlights — Set<string> имён упомянутых пользователей (lower-case, без @)
 */
export default function MessageText({ text, highlights }) {
    if (!text) return null;
    const lines = text.split('\n');
    return (
        <div className="whitespace-pre-wrap break-words">
            {lines.map((line, i) => {
                if (line.startsWith('> ')) {
                    return (
                        <blockquote
                            key={i}
                            className="border-l-2 border-violet-soft pl-3 italic opacity-90 my-1"
                        >
                            {renderInline(line.slice(2), highlights)}
                        </blockquote>
                    );
                }
                if (line === '>') {
                    return <div key={i} className="h-2" />;
                }
                return <div key={i}>{renderInline(line, highlights)}</div>;
            })}
        </div>
    );
}