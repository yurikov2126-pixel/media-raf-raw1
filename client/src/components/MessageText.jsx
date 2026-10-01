import React from 'react';

// Собирает регулярку для одного inline-паттерна
const INLINE_RE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|@[a-z0-9_]{3,20})/gi;

function renderInline(text, highlights = new Set()) {
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