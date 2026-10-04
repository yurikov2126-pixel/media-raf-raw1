/* Утилиты для seed */

export function buildTest(test) {
    if (!test) return null;
    return {
        title: test.title,
        passScore: test.passScore ?? 70,
        questions: (test.questions || []).map((q) => ({
            type: q.type || 'single',
            text: q.text,
            payload: JSON.stringify(q.payload || {}),
            points: q.points ?? 1,
        })),
    };
}

export function slugify(text) {
    return String(text || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-zа-я0-9\s-]/gi, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 80);
}